"""
Authentication routes: register and login.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from backend.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_student,
)
from backend.database import get_db, release_db
from backend.models.schemas import RegisterRequest, LoginRequest, AuthResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest):
    """Register a new student account."""
    conn = await get_db()
    try:
        # Check if name already exists
        existing = await conn.fetchrow(
            "SELECT id FROM students WHERE name = $1", body.name
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A student with that name already exists",
            )

        student_id = str(uuid.uuid4())
        password_hash = hash_password(body.password)
        created_at = datetime.now(timezone.utc).isoformat()

        await conn.execute(
            "INSERT INTO students (id, name, grade_level, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)",
            student_id, body.name, body.grade_level, password_hash, created_at,
        )

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
        await release_db(conn)


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    """Log in with name and password."""
    conn = await get_db()
    try:
        student = await conn.fetchrow(
            "SELECT * FROM students WHERE name = $1", body.name
        )

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
        await release_db(conn)


@router.post("/logout")
async def logout():
    """Log out by clearing the access_token cookie."""
    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(
        key="access_token",
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/me")
async def get_me(student=Depends(get_current_student)):
    """Return the authenticated student from the JWT cookie."""
    return {
        "student_id": student["id"],
        "name": student["name"],
        "email": None,
    }
