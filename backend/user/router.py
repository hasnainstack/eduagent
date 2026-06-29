"""User-facing endpoints — my bookings, cart management, checkout."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth.dependencies import get_current_user
from backend.db.sqlite_setup import (
    CartItem,
    Course as CourseModel,
    User as UserModel,
    get_session,
)
from backend.services.booking_store import create_booking

router = APIRouter(
    prefix="/user",
    tags=["user"],
    dependencies=[Depends(get_current_user)],
)


# ── Schemas ─────────────────────────────────────────────────────


class AddToCartRequest(BaseModel):
    course_id: int


class CheckoutRequest(BaseModel):
    payment_option: str = "discounted"


class CartItemResponse(BaseModel):
    id: int
    course_id: int
    course_title: str
    course_slug: str
    price_usd: float
    discounted_price: float | None = None
    created_at: str


# ── My Bookings ─────────────────────────────────────────────────


@router.get("/my-bookings")
def my_bookings(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Return bookings for the current user (matched by email)."""
    from backend.db.sqlite_setup import Booking as BookingModel

    bookings = (
        db.query(BookingModel)
        .filter(BookingModel.email == current_user.email)
        .order_by(BookingModel.created_at.desc())
        .all()
    )
    return {
        "bookings": [
            {
                "booking_id": b.booking_id,
                "student_name": b.student_name,
                "course_title": b.course_title,
                "course_slug": b.course_slug,
                "amount_due": b.amount_due,
                "payment_option": b.payment_option,
                "status": b.status,
                "created_at": str(b.created_at) if b.created_at else None,
            }
            for b in bookings
        ]
    }


# ── Cart ────────────────────────────────────────────────────────


@router.get("/cart")
def get_cart(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Return cart items with course details."""
    items = (
        db.query(CartItem)
        .filter(CartItem.user_id == current_user.id)
        .order_by(CartItem.created_at.desc())
        .all()
    )
    result = []
    for item in items:
        course = db.query(CourseModel).filter(CourseModel.id == item.course_id).first()
        result.append(
            {
                "id": item.id,
                "course_id": item.course_id,
                "course_title": course.title if course else "Unknown",
                "course_slug": course.slug if course else "",
                "price_usd": course.price_usd if course else 0,
                "discounted_price": course.discounted_price if course else None,
                "created_at": str(item.created_at) if item.created_at else None,
            }
        )
    return {"items": result, "total": len(result)}


@router.post("/cart", status_code=status.HTTP_201_CREATED)
def add_to_cart(
    req: AddToCartRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Add a course to the user's cart."""
    # Verify course exists
    course = db.query(CourseModel).filter(CourseModel.id == req.course_id).first()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Course not found",
        )
    if not course.enrollment_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course is not open for enrollment",
        )

    # Check if already in cart
    existing = (
        db.query(CartItem)
        .filter(
            CartItem.user_id == current_user.id,
            CartItem.course_id == req.course_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Course already in cart",
        )

    cart_item = CartItem(user_id=current_user.id, course_id=req.course_id)
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    return {"id": cart_item.id, "message": "Added to cart"}


@router.delete("/cart/{item_id}")
def remove_from_cart(
    item_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Remove an item from the user's cart."""
    item = (
        db.query(CartItem)
        .filter(CartItem.id == item_id, CartItem.user_id == current_user.id)
        .first()
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cart item not found",
        )
    db.delete(item)
    db.commit()
    return {"message": "Removed from cart"}


# ── Checkout ────────────────────────────────────────────────────


@router.post("/cart/checkout")
def checkout(
    req: CheckoutRequest,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_session),
):
    """Convert all cart items into bookings, then clear the cart."""
    items = (
        db.query(CartItem)
        .filter(CartItem.user_id == current_user.id)
        .all()
    )
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cart is empty",
        )

    bookings_created = []
    for item in items:
        course = db.query(CourseModel).filter(CourseModel.id == item.course_id).first()
        if not course:
            continue

        booking = create_booking(
            student_name=current_user.full_name,
            email=current_user.email,
            course_slug=course.slug,
            payment_option=req.payment_option,
        )
        bookings_created.append(
            {
                "booking_id": booking.booking_id,
                "course_title": booking.course_title,
                "amount_due": booking.amount_due,
            }
        )

        # Delete cart item after successful booking
        db.delete(item)

    db.commit()

    return {
        "message": f"Checked out {len(bookings_created)} course(s)",
        "bookings": bookings_created,
    }
