"""Example FastAPI app using Fathom SDK."""

from fastapi import FastAPI, HTTPException
from fathom_sdk import FathomSDK
from fathom_sdk.integrations.fastapi import FathomFastAPIMiddleware

# Initialize Fathom SDK
sdk = FathomSDK(
    api_key="sk_live_example",
    endpoint="http://localhost:5000",
    app_name="fastapi-example",
    environment="development",
    debug=True,
)

# Create FastAPI app
app = FastAPI(title="Fathom FastAPI Example")

# Add Fathom middleware
app.add_middleware(FathomFastAPIMiddleware, sdk=sdk)

# Install uncaught exception handlers
sdk.capture_uncaught_exceptions()


@app.get("/")
async def root():
    """Root endpoint."""
    sdk.track_metric(title="home_visit", value=1, unit="visits")
    return {"message": "Hello from Fathom FastAPI example"}


@app.get("/users/{user_id}")
async def get_user(user_id: int):
    """Get user by ID."""
    if user_id < 1:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    if user_id > 1000:
        raise HTTPException(status_code=404, detail="User not found")

    return {"user_id": user_id, "name": f"User {user_id}"}


@app.post("/users")
async def create_user(name: str):
    """Create a user."""
    sdk.track_audit(
        title="User created",
        message=f"User '{name}' created",
        metadata={"username": name},
    )
    return {"user_id": 123, "name": name}


@app.get("/error")
async def trigger_error():
    """Trigger an error for testing."""
    try:
        raise ValueError("Intentional error for testing")
    except ValueError as e:
        sdk.track_error(e, metadata={"endpoint": "/error"})
        raise HTTPException(status_code=500, detail="Internal server error")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown handler."""
    print("Shutting down SDK...")
    sdk.shutdown()


if __name__ == "__main__":
    import uvicorn

    print("Starting FastAPI server on http://localhost:8000")
    print("Try:")
    print("  http://localhost:8000/")
    print("  http://localhost:8000/users/42")
    print("  http://localhost:8000/error")
    print("  POST http://localhost:8000/users?name=John")
    print("")
    print("Make sure FATHOM backend is running on http://localhost:5000")

    uvicorn.run(app, host="0.0.0.0", port=8000)
