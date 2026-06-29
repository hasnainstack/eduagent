"""Admin-only CRUD endpoints for courses, instructors, bookings, and users."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.dependencies import require_admin
from backend.db.sqlite_setup import (
    Course,
    Instructor,
    User as UserModel,
    get_session,
)
from backend.services.booking_store import get_all_bookings

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


# ── Schemas ─────────────────────────────────────────────────────


class CourseCreate(BaseModel):
    slug: str
    title: str
    level: str = "Beginner"
    duration_weeks: int = 8
    price_usd: float = 0
    discounted_price: Optional[float] = None
    next_cohort_start: Optional[str] = None
    short_description: str = ""
    enrollment_open: bool = True


class CourseUpdate(BaseModel):
    title: Optional[str] = None
    level: Optional[str] = None
    duration_weeks: Optional[int] = None
    price_usd: Optional[float] = None
    discounted_price: Optional[float] = None
    next_cohort_start: Optional[str] = None
    short_description: Optional[str] = None
    enrollment_open: Optional[bool] = None


class InstructorCreate(BaseModel):
    name: str
    title: str = ""
    bio: str = ""
    expertise: str = ""
    linkedin_url: str = ""
    avatar_url: str = ""


class InstructorUpdate(BaseModel):
    name: Optional[str] = None
    title: Optional[str] = None
    bio: Optional[str] = None
    expertise: Optional[str] = None
    linkedin_url: Optional[str] = None
    avatar_url: Optional[str] = None


# ── Course CRUD ─────────────────────────────────────────────────


@router.get("/courses")
def list_courses(db: Session = Depends(get_session)):
    """List all courses."""
    courses = db.query(Course).order_by(Course.title).all()
    return {
        "courses": [
            {
                "id": c.id,
                "slug": c.slug,
                "title": c.title,
                "level": c.level,
                "duration_weeks": c.duration_weeks,
                "price_usd": c.price_usd,
                "discounted_price": c.discounted_price,
                "next_cohort_start": c.next_cohort_start,
                "short_description": c.short_description,
                "enrollment_open": c.enrollment_open,
            }
            for c in courses
        ]
    }


@router.post("/courses", status_code=status.HTTP_201_CREATED)
def create_course(data: CourseCreate, db: Session = Depends(get_session)):
    """Create a new course."""
    existing = db.query(Course).filter(Course.slug == data.slug).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Course with this slug already exists",
        )
    course = Course(**data.model_dump())
    db.add(course)
    db.commit()
    db.refresh(course)
    return {"id": course.id, "message": "Course created"}


@router.put("/courses/{course_id}")
def update_course(course_id: int, data: CourseUpdate, db: Session = Depends(get_session)):
    """Update an existing course."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    db.commit()
    return {"message": "Course updated"}


@router.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Session = Depends(get_session)):
    """Delete a course."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}


# ── Instructor CRUD ─────────────────────────────────────────────


@router.get("/instructors")
def list_instructors(db: Session = Depends(get_session)):
    """List all instructors."""
    instructors = db.query(Instructor).order_by(Instructor.name).all()
    return {
        "instructors": [
            {
                "id": ins.id,
                "name": ins.name,
                "title": ins.title,
                "bio": ins.bio,
                "expertise": ins.expertise,
                "linkedin_url": ins.linkedin_url,
                "avatar_url": ins.avatar_url,
                "is_active": ins.is_active,
            }
            for ins in instructors
        ]
    }


@router.post("/instructors", status_code=status.HTTP_201_CREATED)
def create_instructor(data: InstructorCreate, db: Session = Depends(get_session)):
    """Create a new instructor."""
    instructor = Instructor(**data.model_dump())
    db.add(instructor)
    db.commit()
    db.refresh(instructor)
    return {"id": instructor.id, "message": "Instructor created"}


@router.put("/instructors/{instructor_id}")
def update_instructor(
    instructor_id: int, data: InstructorUpdate, db: Session = Depends(get_session)
):
    """Update an existing instructor."""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(instructor, key, value)
    db.commit()
    return {"message": "Instructor updated"}


@router.delete("/instructors/{instructor_id}")
def delete_instructor(instructor_id: int, db: Session = Depends(get_session)):
    """Delete an instructor."""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instructor not found")
    db.delete(instructor)
    db.commit()
    return {"message": "Instructor deleted"}


# ── Bookings ────────────────────────────────────────────────────


@router.get("/bookings")
def admin_list_bookings():
    """List all student bookings/applications."""
    bookings = get_all_bookings()
    return {
        "total": len(bookings),
        "bookings": [
            {
                "booking_id": b.booking_id,
                "student_name": b.student_name,
                "email": b.email,
                "course_title": b.course_title,
                "amount_due": b.amount_due,
                "payment_option": b.payment_option,
                "status": b.status,
                "created_at": str(b.created_at) if b.created_at else None,
            }
            for b in bookings
        ],
    }


# ── Users ───────────────────────────────────────────────────────


@router.get("/users")
def list_users(db: Session = Depends(get_session)):
    """List all registered users."""
    users = db.query(UserModel).order_by(UserModel.created_at.desc()).all()
    return {
        "users": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": str(u.created_at),
            }
            for u in users
        ]
    }
