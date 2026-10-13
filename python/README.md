# FATHOM Python Backend

Analytics, ML, and Data Processing for PostgreSQL Monitoring

## Overview

FATHOM Python Backend is a high-performance REST API built with FastAPI that provides advanced analytics, machine learning predictions, and data processing capabilities for the FATHOM database monitoring platform. It handles query analysis, anomaly detection, capacity forecasting, and metric aggregation.

## Quick Start

### Prerequisites

- Python 3.11+
- pip or uv

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd python

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env.example .env

# Run the development server
uvicorn api.main:app --reload
```

The API will be available at `http://localhost:8000`

## API Documentation

Interactive API documentation is available at:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Project Structure

```
python/
├── api/                      # FastAPI application
│   ├── __init__.py
│   ├── main.py              # Application entry point
│   ├── models/              # Pydantic models and schemas
│   ├── routes/              # API endpoints
│   └── services/            # Business logic
├── tests/                   # Test suite
│   ├── __init__.py
│   ├── test_analysis.py     # Query and stats analysis tests
│   └── test_ml.py           # ML model tests
├── requirements.txt         # Python dependencies
├── pyproject.toml          # Project configuration
├── Dockerfile              # Container image definition
├── .env.example            # Environment variables template
└── README.md               # This file
```

## Features

- **Query Analysis**: Parse and analyze SQL queries for performance patterns
- **Anomaly Detection**: Identify unusual database metrics using statistical methods
- **Capacity Forecasting**: Predict future resource usage and capacity limits
- **Query Classification**: Categorize queries by type (read, write, aggregation, etc.)
- **Performance Metrics**: Aggregate and process database statistics

## Testing

Run the test suite with pytest:

```bash
pip install pytest pytest-asyncio
pytest tests/ -v
```

## Docker

Build and run the application in a Docker container:

```bash
docker build -t fathom-python:latest .
docker run -p 8000:8000 --env-file .env fathom-python:latest
```

## Configuration

Environment variables are loaded from `.env`. See `.env.example` for all available options:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis cache connection
- `NODE_BACKEND_URL`: Node.js backend service URL
- `PORT`: API server port (default: 8000)
- `DEBUG`: Enable debug mode
- `CORS_ORIGINS`: Comma-separated CORS-allowed origins

## License

MIT
