import datetime
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------
# Database Engine Setup
# ---------------------------------------------------------
# SQLite database file URL located in the project root
DATABASE_URL = "sqlite:///./translator.db"

# Engine configuration for SQLite
# Note: connect_args={"check_same_thread": False} is required for SQLite in multi-threaded 
# environments like FastAPI, since SQLite is file-based and by default restricts database 
# access to the thread that initialized the connection.
#
# COMPARISON TO HOW PACE USES MYSQL:
# 1) Connection URL: PACE connects to a remote MySQL database using a network URI format like:
#    "mysql+pymysql://<user>:<password>@<host>:<port>/<dbname>". MySQL requires server-side 
#    credentials, network socket routes (host/port), and a database driver (e.g. pymysql), 
#    whereas SQLite runs entirely locally as an embedded file without credentials.
# 2) Connection Pooling: SQLite uses simple single-threaded direct file locks. PACE (MySQL) 
#    requires connection pooling parameters in create_engine (such as `pool_size=10`, 
#    `max_overflow=20`, `pool_recycle=3600`) to manage the pool of persistent network 
#    connections and recycle them before the MySQL server times them out.
# 3) Thread Safety: PACE does not require `connect_args={"check_same_thread": False}` 
#    because MySQL natively manages concurrent, multi-threaded connections securely.
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False}
)

# ---------------------------------------------------------
# SessionLocal Configuration
# ---------------------------------------------------------
# Session factory for generating database transaction sessions
#
# COMPARISON TO HOW PACE USES MYSQL:
# - Both configurations set `autocommit=False` and `autoflush=False` to manage transactions manually.
# - In PACE (MySQL), uncommitted transactions can keep InnoDB locks open (row/table level), 
#   affecting network-wide database concurrency. In SQLite, lock contention locks the entire database file, 
#   which is simpler but heavily restricts write concurrency compared to MySQL's granular locking.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ---------------------------------------------------------
# Declarative Base
# ---------------------------------------------------------
# Base class for all declarative ORM database models
#
# COMPARISON TO HOW PACE USES MYSQL:
# - Both use declarative_base() to create the Base metadata registry.
# - In PACE (MySQL), `Base.metadata` is standard for Alembic migration autogeneration. 
#   SQLite has very limited support for schema alterations (e.g. dropping columns or altering constraints 
#   is not supported directly and requires batch table rebuilding). In contrast, MySQL fully supports 
#   dynamic `ALTER TABLE` operations.
Base = declarative_base()

# ---------------------------------------------------------
# Dependency: get_db
# ---------------------------------------------------------
# FastAPI Dependency injection function yielding a database session
# to endpoints and guaranteeing connection cleanup.
#
# COMPARISON TO HOW PACE USES MYSQL:
# - The yield dependency lifecycle (open -> yield -> close) is identical in both.
# - In PACE (MySQL), calling `db.close()` releases the connection back into the SQLAlchemy connection 
#   pool for reuse. In SQLite, it closes the direct file handle stream.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------------------------------------------------
# Translation Database Model
# ---------------------------------------------------------
# Database schema mapping for the 'translations' table
#
# COMPARISON TO HOW PACE USES MYSQL:
# 1) Auto-incrementing IDs: Integer primary keys in SQLite auto-increment implicitly. 
#    In PACE (MySQL), this translates to an explicit INT AUTO_INCREMENT DDL constraint.
# 2) Variable Strings: SQLite allows string fields without length limits. In PACE (MySQL), 
#    you must specify max length constraints (e.g., `String(255)`) because MySQL requires 
#    defined sizing for indexing string columns (VARCHAR limits).
# 3) Boolean Types: SQLite has no native Boolean type; it maps Boolean columns to integers 0/1. 
#    PACE (MySQL) represents Boolean values as TINYINT(1) types.
# 4) Datetime Defaults: SQLite stores dates as strings/integers and uses python-side default callbacks. 
#    PACE (MySQL) uses native TIMESTAMP or DATETIME fields and can delegate defaults to the database server 
#    level (e.g. `server_default=func.now()`).
class Translation(Base):
    __tablename__ = "translations"

    id = Column(Integer, primary_key=True, index=True)
    original_text = Column(String, nullable=False)
    translated_text = Column(String, nullable=False)
    source_language = Column(String, nullable=False)
    target_language = Column(String, nullable=False)
    is_favourite = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
