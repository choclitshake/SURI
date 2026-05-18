"""
Authentication routes: register and login.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from backend.auth import hash_password, verify_password, create_access_token
from backend.database import get_db
from backend.models.schemas import RegisterRequest, LoginRequest, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    """Register a new student account."""
    db = await get_db()
    try:
        # Check if name already exists
        cursor = await db.execute("SELECT id FROM students WHERE name = ?", (body.name,))
        existing = await cursor.fetchone()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with that name already exists",
            )

        student_id = str(uuid.uuid4())
        password_hash = hash_password(body.password)
        created_at = datetime.now(timezone.utc).isoformat()

        await db.execute(
            "INSERT INTO students (id, name, grade_level, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
            (student_id, body.name, body.grade_level, password_hash, created_at),
        )
        await db.commit()

        token = create_access_token(student_id, body.name)

        response = JSONResponse(
            content={"student_id": student_id, "token": token},
            status_code=status.HTTP_201_CREATED,
        )
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60,  # 7 days
        )
        return response
    finally:
        await db.close()


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """Log in with name and password."""
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM students WHERE name = ?", (body.name,))
        student = await cursor.fetchone()

        if not student:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid name or password",
            )

        student = dict(student)
        if not verify_password(body.password, student["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid name or password",
            )

        token = create_access_token(student["id"], student["name"])

        response = JSONResponse(
            content={"student_id": student["id"], "token": token},
        )
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            samesite="lax",
            max_age=7 * 24 * 60 * 60,  # 7 days
        )
        return response
    finally:
        await db.close()
