"""LangChain tools for the Nova sales agent.

Each tool returns formatted text suitable for the LLM to use
in generating a voice response, using built-in fallback data.
"""

from typing import Optional, Type

from langchain_core.tools import BaseTool
from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════════
#  Comprehensive Fee Structure Data
#  Used as fallback when the database is unavailable
# ═══════════════════════════════════════════════════════════════════

FEE_STRUCTURE: dict[str, dict] = {
    "fullstack-web-bootcamp": {
        "title": "Full-Stack Web Development Bootcamp",
        "slug": "fullstack-web-bootcamp",
        "level": "Beginner",
        "duration_weeks": 16,
        "upfront_price": 1299,
        "discounted_price": 999,
        "early_bird_price": 1099,
        "early_bird_save": 200,
        "installment": {
            "down_payment": 499,
            "monthly": 267,
            "months": 3,
            "total": 1299,
        },
        "subscription_tier": "Pro",
        "registration_fee": 49,
        "reg_fee_waived": True,
        "certificate": True,
        "materials": True,
        "mentorship": False,
        "refund": "7-day full refund; 14-day 50% refund after cohort starts",
        "next_cohort": "July 14, 2026",
    },
    "data-science-masterclass": {
        "title": "Data Science Masterclass",
        "slug": "data-science-masterclass",
        "level": "Intermediate",
        "duration_weeks": 12,
        "upfront_price": 1499,
        "discounted_price": 1199,
        "early_bird_price": 1299,
        "early_bird_save": 200,
        "installment": {
            "down_payment": 599,
            "monthly": 300,
            "months": 3,
            "total": 1499,
        },
        "subscription_tier": "Pro",
        "registration_fee": 49,
        "reg_fee_waived": True,
        "certificate": True,
        "materials": True,
        "mentorship": False,
        "refund": "7-day full refund; 14-day 50% refund",
        "next_cohort": "August 4, 2026",
    },
    "aiml-engineering": {
        "title": "AI/ML Engineering Program",
        "slug": "aiml-engineering",
        "level": "Advanced",
        "duration_weeks": 14,
        "upfront_price": 1699,
        "discounted_price": 1399,
        "early_bird_price": 1499,
        "early_bird_save": 200,
        "installment": {
            "down_payment": 699,
            "monthly": 333,
            "months": 3,
            "total": 1699,
        },
        "subscription_tier": "Pro Plus",
        "registration_fee": 49,
        "reg_fee_waived": True,
        "certificate": True,
        "materials": True,
        "mentorship": True,
        "refund": "7-day full refund; 14-day 50% refund",
        "next_cohort": "September 1, 2026",
    },
    "uiux-design": {
        "title": "UI/UX Design Certificate",
        "slug": "uiux-design",
        "level": "Beginner",
        "duration_weeks": 8,
        "upfront_price": 799,
        "discounted_price": 599,
        "early_bird_price": 699,
        "early_bird_save": 100,
        "installment": {
            "down_payment": 299,
            "monthly": 166,
            "months": 3,
            "total": 799,
        },
        "subscription_tier": "Starter",
        "registration_fee": 49,
        "reg_fee_waived": True,
        "certificate": True,
        "materials": True,
        "mentorship": False,
        "refund": "7-day full refund; 14-day 50% refund",
        "next_cohort": "July 21, 2026",
    },
    "devops-cloud": {
        "title": "DevOps & Cloud Engineering",
        "slug": "devops-cloud",
        "level": "Intermediate",
        "duration_weeks": 10,
        "upfront_price": 999,
        "discounted_price": 799,
        "early_bird_price": 899,
        "early_bird_save": 100,
        "installment": {
            "down_payment": 399,
            "monthly": 200,
            "months": 3,
            "total": 999,
        },
        "subscription_tier": "Pro",
        "registration_fee": 49,
        "reg_fee_waived": True,
        "certificate": True,
        "materials": True,
        "mentorship": False,
        "refund": "7-day full refund; 14-day 50% refund",
        "next_cohort": "August 18, 2026",
    },
}

SUBSCRIPTION_PLANS: dict[str, dict] = {
    "free": {
        "name": "Free",
        "price_monthly": 0,
        "features": ["Access to introductory modules", "Community forum access", "Course previews & sample lessons"],
        "is_popular": False,
    },
    "starter": {
        "name": "Starter",
        "price_monthly": 29,
        "features": ["Core course access (UI/UX, beginner tracks)", "Certificate of completion per course", "Email support"],
        "is_popular": False,
    },
    "pro": {
        "name": "Pro",
        "price_monthly": 79,
        "features": ["Full course library access", "All certificates included", "Priority email support", "Project reviews by TAs", "Career guidance resources"],
        "is_popular": True,
    },
    "pro-plus": {
        "name": "Pro Plus",
        "price_monthly": 129,
        "features": ["Everything in Pro", "1-on-1 mentorship sessions (weekly)", "Resume & portfolio review", "Job placement support", "Lifetime course access"],
        "is_popular": False,
    },
    "team": {
        "name": "Team",
        "price_monthly": None,
        "features": ["Everything in Pro Plus", "Bulk enrollment discounts", "Custom learning paths", "Team analytics dashboard", "Dedicated success manager"],
        "is_popular": False,
    },
}

SCHOLARSHIPS_DATA: list[dict] = [
    {
        "name": "Pakistan/South Asia Regional Discount",
        "discount_pct": 40,
        "description": "Special pricing for students from Pakistan, India, Bangladesh, Sri Lanka, and Nepal — making tech education more accessible across the region.",
        "eligibility": "Residents of South Asian countries (proof of residency required)",
        "deadline": "Rolling — apply anytime",
        "apply_url": "devnestacademy.com/scholarships/south-asia",
    },
    {
        "name": "Women in Tech Scholarship",
        "discount_pct": 30,
        "description": "Supporting gender diversity in technology with partial tuition coverage for female students.",
        "eligibility": "Female-identifying applicants",
        "deadline": "July 30, 2026",
        "apply_url": "devnestacademy.com/scholarships/women-in-tech",
    },
    {
        "name": "Merit-Based Scholarship",
        "discount_pct": 50,
        "description": "For outstanding applicants with strong academic or professional backgrounds. Covers up to 50% of tuition.",
        "eligibility": "Based on application assessment, prior portfolio, or academic record",
        "deadline": "Rolling — up to 5 awarded per cohort",
        "apply_url": "devnestacademy.com/scholarships/merit",
    },
    {
        "name": "Early Bird Discount",
        "discount_pct": 15,
        "description": "Enroll at least 2 weeks before cohort start and save 15% on tuition.",
        "eligibility": "Enrollment completed 14+ days before cohort start date",
        "deadline": "Varies by cohort (auto-applied at checkout)",
        "apply_url": "Auto-applied at checkout",
    },
]

# ── Helper ────────────────────────────────────────────────────────

def _format_fee_structure(slug: str, data: dict) -> str:
    """Format a single course's fee structure into readable text."""
    installment = data["installment"]
    reg_fee = data["registration_fee"]
    reg_note = " (waived with early bird)" if data["reg_fee_waived"] else ""
    mentorship = "✓ Includes 1-on-1 mentorship" if data["mentorship"] else "Standard support (no 1-on-1 mentorship)"
    lines = [
        f"📘 {data['title']}",
        f"   Level: {data['level']} | Duration: {data['duration_weeks']} weeks | Next cohort: {data['next_cohort']}",
        "",
        f"   ── Fee Options ──",
        f"   • Pay Upfront:  ${data['upfront_price']:,}",
        f"   • Discounted:    ${data['discounted_price']:,} (limited-time offer)",
        f"   • Early Bird:    ${data['early_bird_price']:,} (save ${data['early_bird_save']})",
        f"   • Installment:   ${installment['down_payment']} down + ${installment['monthly']}/month for {installment['months']} months (${installment['total']:,} total)",
        "",
        f"   ── What's Included ──",
        f"   • Certificate of completion: {'✓' if data['certificate'] else '—'}",
        f"   • Course materials & resources: {'✓' if data['materials'] else '—'}",
        f"   • {mentorship}",
        f"   • Registration fee: ${reg_fee}{reg_note}",
        f"   • Access via {data['subscription_tier']} subscription tier",
        "",
        f"   ── Refund Policy ──",
        f"   • {data['refund']}",
    ]
    return "\n".join(lines)


# ── Tool Schemas ──────────────────────────────────────────────

class SearchCoursesInput(BaseModel):
    query: str = Field(description="Natural language query about courses, e.g. 'Python courses' or 'beginner friendly web dev'")

class GetCourseDetailsInput(BaseModel):
    slug_or_title: str = Field(description="Course slug or full title, e.g. 'fullstack-web-bootcamp' or 'Data Science Masterclass'")

class SearchFAQsInput(BaseModel):
    query: str = Field(description="Natural language question about admissions, fees, refunds, certificates, etc.")

class GetPricingInput(BaseModel):
    plan_name: Optional[str] = Field(default=None, description="Optional plan slug to filter by (free, starter, pro, pro-plus, team)")

class GetScholarshipsInput(BaseModel):
    query: str = Field(default="", description="Optional search query for filtering scholarships")

class GetFeeStructureInput(BaseModel):
    course: Optional[str] = Field(default=None, description="Course slug, title, or keyword to get detailed fee breakdown. Leave empty to see all courses with pricing.")


# ── Tools ────────────────────────────────────────────────────

class SearchCoursesTool(BaseTool):
    name: str = "search_courses"
    description: str = "Search for courses by natural language query. Returns top 3-5 matching courses with title, price, duration, level, and next cohort date."
    args_schema: Type[BaseModel] = SearchCoursesInput

    async def _arun(self, query: str) -> str:
        """Async variant — delegates to sync fallback."""
        return self._fallback_courses_with_fees(query)

    def _run(self, query: str) -> str:
        return self._fallback_courses_with_fees(query)

    @staticmethod
    def _course_lookup(query: str) -> list[dict]:
        """Match a query string to course(s) in the fee structure by keyword."""
        q = query.lower()
        matches = []
        for slug, data in FEE_STRUCTURE.items():
            title_lower = data["title"].lower()
            words = title_lower.split()
            # Score: direct slug match, title match, keyword match
            if slug in q or q in slug:
                score = 3
            elif title_lower == q or title_lower.startswith(q) or q.startswith(title_lower):
                score = 3
            elif any(w in q for w in words) or any(q in w for w in words):
                score = 2
            elif any(kw in title_lower for kw in ["web", "fullstack", "bootcamp", "python", "javascript"]):
                if any(kw in q for kw in ["web", "fullstack", "bootcamp", "python", "javascript", "programming"]):
                    score = 2
                else:
                    score = 0
            elif any(kw in title_lower for kw in ["data", "science", "analytics"]):
                if any(kw in q for kw in ["data", "science", "analytics", "python", "sql"]):
                    score = 2
                else:
                    score = 0
            elif any(kw in title_lower for kw in ["ai", "ml", "machine", "deep"]):
                if any(kw in q for kw in ["ai", "ml", "machine", "deep", "neural", "artificial"]):
                    score = 2
                else:
                    score = 0
            elif any(kw in title_lower for kw in ["ui", "ux", "design", "figma"]):
                if any(kw in q for kw in ["ui", "ux", "design", "figma", "user interface"]):
                    score = 2
                else:
                    score = 0
            elif any(kw in title_lower for kw in ["devops", "cloud", "aws", "docker"]):
                if any(kw in q for kw in ["devops", "cloud", "aws", "docker", "kubernetes", "deploy"]):
                    score = 2
                else:
                    score = 0
            else:
                score = 0
            if score > 0:
                matches.append((score, slug, data))
        matches.sort(key=lambda x: -x[0])
        return [{"slug": slug, **data} for score, slug, data in matches]

    @staticmethod
    def _fallback_courses_with_fees(query: str) -> str:
        """Return courses matched to the query, with prices, from the fee structure."""
        matched = SearchCoursesTool._course_lookup(query)
        if matched:
            lines = ["Here are the courses that match your interest:"]
            for i, c in enumerate(matched[:4], 1):
                cohort = c.get("next_cohort", "")
                cohort_str = f", next cohort: {cohort}" if cohort else ""
                lines.append(
                    f"{i}. {c['title']} — ${c['discounted_price']:,}, "
                    f"{c['duration_weeks']} weeks, {c['level']} level{cohort_str}"
                )
            lines.append(
                "\nWant detailed fee info? Ask me about installment plans, "
                "early bird discounts, or scholarships for any course!"
            )
            return "\n".join(lines)

        # No match — show all courses as a catalog
        return (
            "DevNest Academy offers these tech courses:\n"
            "1. Full-Stack Web Development Bootcamp — $999, 16 weeks, beginner-friendly\n"
            "2. Data Science Masterclass — $1,199, 12 weeks, intermediate\n"
            "3. AI/ML Engineering Program — $1,399, 14 weeks, advanced\n"
            "4. UI/UX Design Certificate — $599, 8 weeks, beginner-friendly\n"
            "5. DevOps & Cloud Engineering — $799, 10 weeks, intermediate\n\n"
            "Each course has flexible payment options including upfront, installment plans, "
            "and early bird discounts. Ask me for the full fee structure of any course!"
        )


class GetCourseDetailsTool(BaseTool):
    name: str = "get_course_details"
    description: str = "Get full details about a specific course including modules, instructor bio, prerequisites, and skills. Pass the course slug or title."
    args_schema: Type[BaseModel] = GetCourseDetailsInput

    async def _arun(self, slug_or_title: str) -> str:
        """Async variant — delegates to fallback."""
        return self._fallback_details_with_fees(slug_or_title)

    def _run(self, slug_or_title: str) -> str:
        return self._fallback_details_with_fees(slug_or_title)

    @staticmethod
    def _fallback_details_with_fees(slug_or_title: str) -> str:
        """Return detailed info from the fee structure when DB is down."""
        q = slug_or_title.lower().strip()
        found = None
        # Try slug match first
        if q in FEE_STRUCTURE:
            found = FEE_STRUCTURE[q]
        else:
            # Try title match
            for slug, data in FEE_STRUCTURE.items():
                if q == data["title"].lower() or q in data["title"].lower() or data["title"].lower() in q:
                    found = data
                    break
        if not found:
            return (
                f"I couldn't find a course called '{slug_or_title}'. "
                f"Our courses are: Full-Stack Web Development Bootcamp, Data Science Masterclass, "
                f"AI/ML Engineering Program, UI/UX Design Certificate, and DevOps & Cloud Engineering. "
                f"Try asking about one of these!"
            )
        return _format_fee_structure(found["slug"], found)


class SearchFAQsTool(BaseTool):
    name: str = "search_faqs"
    description: str = "Search frequently asked questions about admissions, fees, refunds, certificates, career support, and technical requirements."
    args_schema: Type[BaseModel] = SearchFAQsInput

    async def _arun(self, query: str) -> str:
        """Async variant — delegates to keyword-based FAQ fallback."""
        return self._faq_fallback_by_keyword(query)

    def _run(self, query: str) -> str:
        return self._faq_fallback_by_keyword(query)

    @staticmethod
    def _faq_fallback_by_keyword(query: str) -> str:
        """Return FAQ answers from built-in knowledge when DB is down."""
        q = query.lower()

        fee_keywords = ["fee", "cost", "price", "tuition", "payment", "installment", "pay", "pricing", "scholarship", "discount", "refund"]
        admission_keywords = ["admission", "enroll", "apply", "application", "start", "join", "register"]
        cert_keywords = ["certificate", "certification", "diploma", "degree", "accreditation"]
        career_keywords = ["job", "career", "placement", "hire", "employment", "salary", "work"]
        tech_keywords = ["requirement", "computer", "laptop", "spec", "browser", "internet", "software"]

        if any(k in q for k in fee_keywords):
            return (
                "Here's what I can tell you about fees at DevNest Academy:\n\n"
                "💰 **Payment Options:** Every course can be paid upfront (best value), "
                "via 3-month installment plan, or accessed through a monthly subscription.\n\n"
                "🎯 **Early Bird Discount:** Save $100–$200 by enrolling 14+ days before cohort start.\n\n"
                "🎓 **Scholarships:** We offer a 40% South Asia Regional Discount, "
                "30% Women in Tech Scholarship, up to 50% Merit-Based Scholarship, "
                "and a 15% Early Bird Discount. Some can be combined!\n\n"
                "💳 **Registration Fee:** $49 one-time (waived with early bird enrollment).\n\n"
                "🔄 **Refund Policy:** Full refund within 7 days of cohort start, "
                "50% refund within 14 days.\n\n"
                "Want specific numbers? Ask me for the fee structure of any course!"
            )
        if any(k in q for k in admission_keywords):
            return (
                "DevNest Academy has rolling admissions — you can apply anytime! "
                "Here's the process:\n\n"
                "1. Browse our courses and pick the one that fits your goals\n"
                "2. Click 'Enroll' on the course page\n"
                "3. Choose your payment option (upfront, installment, or subscription)\n"
                "4. Apply any scholarships or discount codes\n"
                "5. You're in! You'll get access to the pre-course materials immediately\n\n"
                "No entrance exams or prior degree required for beginner-level courses. "
                "Advanced courses may need a portfolio review or prerequisite knowledge."
            )
        if any(k in q for k in cert_keywords):
            return (
                "Yes! Every DevNest Academy course includes a certificate of completion "
                "once you finish all modules and pass the final project. Our certificates "
                "are recognized by industry partners and can be added to your LinkedIn profile. "
                "Pro and Pro Plus subscribers get all certificates included."
            )
        if any(k in q for k in career_keywords):
            return (
                "DevNest Academy offers comprehensive career support:\n\n"
                "• Resume & portfolio reviews (Pro Plus tier)\n"
                "• 1-on-1 career mentoring sessions\n"
                "• Job placement assistance with our hiring partners\n"
                "• Weekly mock interviews and coding challenges\n\n"
                "Our graduates have been hired at companies like Careem, Systems Ltd, "
                "Afiniti, and various international remote-first startups."
            )
        if any(k in q for k in tech_keywords):
            return (
                "Here's what you need to take a DevNest course:\n\n"
                "• A computer (Windows, Mac, or Linux) with at least 8GB RAM\n"
                "• Stable internet connection\n"
                "• Modern web browser (Chrome or Firefox recommended)\n"
                "• For AI/ML and Data Science courses: a GPU is helpful but not required "
                "(we provide cloud compute access)\n"
                "• Headset/mic for mentoring sessions\n\n"
                "All courses are delivered online through our learning platform."
            )

        # Generic fallback
        return (
            "I can answer questions about:\n"
            "💰 **Fees & Payments** — course pricing, installment plans, early bird discounts\n"
            "🎓 **Scholarships** — South Asia regional discount, Women in Tech, merit-based\n"
            "📋 **Admissions** — how to enroll, rolling admissions, no entrance exams\n"
            "📜 **Certificates** — completion certificates, LinkedIn sharing\n"
            "💼 **Career Support** — job placement, resume reviews, mentoring\n"
            "💻 **Tech Requirements** — what you need to start learning\n\n"
            "What would you like to know more about?"
        )


class GetPricingTool(BaseTool):
    name: str = "get_pricing"
    description: str = "Get DevNest Academy subscription plans and per-course pricing. Optionally filter by plan name (free, starter, pro, pro-plus, team)."
    args_schema: Type[BaseModel] = GetPricingInput

    async def _arun(self, plan_name: Optional[str] = None) -> str:
        """Async variant — delegates to subscription fallback."""
        return self._subscription_fallback(plan_name)

    def _run(self, plan_name: Optional[str] = None) -> str:
        return self._subscription_fallback(plan_name)

    @staticmethod
    def _subscription_fallback(plan_name: Optional[str] = None) -> str:
        """Return pricing data from SUBSCRIPTION_PLANS when DB is down."""
        if plan_name:
            slug = plan_name.lower().replace(" ", "-")
            if slug in SUBSCRIPTION_PLANS:
                p = SUBSCRIPTION_PLANS[slug]
                price_str = f"${p['price_monthly']}/month" if p["price_monthly"] else "Custom pricing"
                lines = [
                    f"**{p['name']} Plan** — {price_str}",
                ]
                if p["features"]:
                    lines.append("Features:")
                    for f in p["features"]:
                        lines.append(f"  ✓ {f}")
                return "\n".join(lines)
            return (
                f"I don't have a plan called '{plan_name}'. "
                f"Our plans are: Free, Starter ($29/mo), Pro ($79/mo), Pro Plus ($129/mo), and Team (custom)."
            )

        # Show all plans + course pricing overview
        lines = [
            "**📋 DevNest Academy — Complete Pricing**",
            "",
            "── Monthly Subscription Plans ──",
        ]
        for slug, p in SUBSCRIPTION_PLANS.items():
            price_str = f"${p['price_monthly']}/month" if p["price_monthly"] else "Custom pricing"
            popular = " ⭐ Most Popular" if p["is_popular"] else ""
            lines.append(f"  • {p['name']} — {price_str}{popular}")
            for f in p["features"]:
                lines.append(f"     ✓ {f}")

        lines += [
            "",
            "── Per-Course Pricing (One-Time) ──",
        ]
        for slug, c in FEE_STRUCTURE.items():
            lines.append(f"  • {c['title']} — ${c['discounted_price']:,} (was ${c['upfront_price']:,})")

        lines += [
            "",
            "💡 **Save more with:**",
            "  • Early bird discount (15% off, enroll 14+ days early)",
            "  • Installment plans (as low as $166/month)",
            "  • Scholarships (up to 50% off tuition)",
            "",
            "Ask me about scholarships or the fee breakdown for any specific course!",
        ]
        return "\n".join(lines)


class GetScholarshipsTool(BaseTool):
    name: str = "get_scholarships"
    description: str = "Get information about available scholarships and discounts including the Pakistan/South Asia regional discount, Women in Tech, merit-based, and early bird."
    args_schema: Type[BaseModel] = GetScholarshipsInput

    async def _arun(self, query: str = "") -> str:
        """Async variant — delegates to scholarship fallback."""
        return self._scholarship_fallback(query)

    def _run(self, query: str = "") -> str:
        return self._scholarship_fallback(query)

    @staticmethod
    def _scholarship_fallback(query: str = "") -> str:
        """Return scholarship data from SCHOLARSHIPS_DATA when DB is down."""
        q = query.lower().strip()

        # Filter by keyword if query provided
        if q:
            matched = [s for s in SCHOLARSHIPS_DATA if any(kw in q for kw in s["name"].lower().split())]
            if not matched:
                matched = [s for s in SCHOLARSHIPS_DATA if any(
                    kw in q for kw in ["pakistan", "south", "asia", "regional", "south asia",
                                       "women", "female", "gender",
                                       "merit", "merit-based", "academic",
                                       "early", "early bird", "discount"]
                )]
            if not matched:
                return (
                    f"I don't have a scholarship matching '{query}', but here's what we offer:\n"
                    "• Pakistan/South Asia Regional — 40% off\n"
                    "• Women in Tech — 30% off\n"
                    "• Merit-Based — up to 50% off\n"
                    "• Early Bird — 15% off\n\n"
                    "Ask me for details on any of these!"
                )
            scholarships = matched
        else:
            scholarships = SCHOLARSHIPS_DATA

        lines = ["**🎓 DevNest Academy — Scholarships & Discounts**"]
        for s in scholarships:
            lines.append(f"\n📌 {s['name']} — **{s['discount_pct']}% off**")
            lines.append(f"   {s['description']}")
            lines.append(f"   Eligibility: {s['eligibility']}")
            lines.append(f"   Deadline: {s['deadline']}")
            lines.append(f"   Apply: {s['apply_url']}")

        lines.append(
            "\n💡 **Pro tip:** Some scholarships can be combined! "
            "For example, the South Asia Regional Discount can stack with Early Bird. "
            "Ask me what your best price would be for a specific course!"
        )
        return "\n".join(lines)


class GetFeeStructureTool(BaseTool):
    name: str = "get_fee_structure"
    description: str = "Get the detailed fee breakdown for any course — upfront price, discounted price, installment plan, early bird discount, and what's included. Pass a course name like 'Full-Stack Web Development Bootcamp' or leave empty to compare all courses."
    args_schema: Type[BaseModel] = GetFeeStructureInput

    async def _arun(self, course: Optional[str] = None) -> str:
        if not course:
            return self._all_courses_summary()

        q = course.lower().strip()

        # Try direct slug match
        if q in FEE_STRUCTURE:
            return _format_fee_structure(q, FEE_STRUCTURE[q])

        # Try title match
        for slug, data in FEE_STRUCTURE.items():
            if q == data["title"].lower() or data["title"].lower() in q or q in data["title"].lower():
                return _format_fee_structure(slug, data)

        # Try keyword match
        keyword_map = {
            "web": "fullstack-web-bootcamp",
            "fullstack": "fullstack-web-bootcamp",
            "full stack": "fullstack-web-bootcamp",
            "bootcamp": "fullstack-web-bootcamp",
            "javascript": "fullstack-web-bootcamp",
            "python": "fullstack-web-bootcamp",  # could be data science too
            "data": "data-science-masterclass",
            "data science": "data-science-masterclass",
            "science": "data-science-masterclass",
            "analytics": "data-science-masterclass",
            "ai": "aiml-engineering",
            "ml": "aiml-engineering",
            "machine": "aiml-engineering",
            "artificial": "aiml-engineering",
            "deep": "aiml-engineering",
            "neural": "aiml-engineering",
            "ui": "uiux-design",
            "ux": "uiux-design",
            "design": "uiux-design",
            "figma": "uiux-design",
            "devops": "devops-cloud",
            "cloud": "devops-cloud",
            "aws": "devops-cloud",
            "docker": "devops-cloud",
        }
        for keyword, slug in keyword_map.items():
            if keyword in q:
                return _format_fee_structure(slug, FEE_STRUCTURE[slug])

        return (
            f"I couldn't find a course matching '{course}'. Our courses are:\n"
            + "\n".join(f"  • {data['title']} — from ${data['discounted_price']:,}" for data in FEE_STRUCTURE.values())
            + "\n\nWhich one would you like fee details for?"
        )

    def _run(self, course: Optional[str] = None) -> str:
        raise NotImplementedError("Use async")

    @staticmethod
    def _all_courses_summary() -> str:
        """Return a comparison summary of all course fees."""
        lines = [
            "**📊 DevNest Academy — Course Fee Comparison**",
            "",
            f"{'Course':<40} {'Upfront':>8} {'Discounted':>11} {'Early Bird':>11} {'Installment':>11}",
            f"{'─────':<40} {'───────':>8} {'─────────':>11} {'─────────':>11} {'──────────':>11}",
        ]
        for slug, c in FEE_STRUCTURE.items():
            inst = c["installment"]
            inst_str = f"${inst['down_payment']}+${inst['monthly']}/mo"
            lines.append(
                f"{c['title']:<40} ${c['upfront_price']:>5,}  ${c['discounted_price']:>5,}  "
                f"${c['early_bird_price']:>5,}  {inst_str}"
            )

        lines += [
            "",
            "**Payment Methods:** All major credit/debit cards, PayPal, and bank transfer.",
            "**Registration Fee:** $49 one-time (waived with early bird).",
            "**Refund Policy:** 7-day full refund, 14-day 50% refund.",
            "",
            "🎯 Ask about scholarships to bring the price down even more!",
        ]
        return "\n".join(lines)


class BookCourseInput(BaseModel):
    student_name: str = Field(description="Full name of the student enrolling")
    email: str = Field(description="Student's email address")
    course_slug: str = Field(description="Course slug or title they want to enroll in, e.g. 'fullstack-web-bootcamp' or 'Data Science Masterclass'")
    payment_option: str = Field(default="discounted", description="Payment option: upfront (full price), discounted (best value), early_bird (enroll 14+ days early), installment (down+monthly), or scholarship (with discount code)")


class BookCourseTool(BaseTool):
    name: str = "book_course"
    description: str = "Enroll a student in a course. Requires the student's name, email, course slug or title, and payment preference. Use this when a student says they want to enroll, sign up, register, or book a course."
    args_schema: Type[BaseModel] = BookCourseInput

    async def _arun(
        self,
        student_name: str,
        email: str,
        course_slug: str,
        payment_option: str = "discounted",
    ) -> str:
        """Create a booking and return confirmation."""
        from backend.services.booking_store import create_booking

        # Resolve course slug
        slug = course_slug.lower().strip()
        resolved_slug = None
        if slug in FEE_STRUCTURE:
            resolved_slug = slug
        else:
            for s, data in FEE_STRUCTURE.items():
                if slug == s or data["title"].lower() == slug or data["title"].lower() in slug or slug in data["title"].lower():
                    resolved_slug = s
                    break

        if not resolved_slug:
            # Keyword match
            keyword_map = {
                "web": "fullstack-web-bootcamp", "fullstack": "fullstack-web-bootcamp",
                "bootcamp": "fullstack-web-bootcamp",
                "data": "data-science-masterclass", "science": "data-science-masterclass",
                "ai": "aiml-engineering", "ml": "aiml-engineering",
                "machine": "aiml-engineering", "artificial": "aiml-engineering",
                "ui": "uiux-design", "ux": "uiux-design", "design": "uiux-design",
                "devops": "devops-cloud", "cloud": "devops-cloud", "aws": "devops-cloud",
            }
            for kw, s in keyword_map.items():
                if kw in slug:
                    resolved_slug = s
                    break

        if not resolved_slug:
            course_list = ", ".join(f"'{d['title']}'" for d in FEE_STRUCTURE.values())
            return (
                f"I couldn't find a course matching '{course_slug}'. "
                f"Please pick one of: {course_list}."
            )

        course = FEE_STRUCTURE[resolved_slug]
        valid_options = ["upfront", "discounted", "early_bird", "installment", "scholarship"]
        if payment_option not in valid_options:
            payment_option = "discounted"

        try:
            booking = create_booking(
                student_name=student_name,
                email=email,
                course_slug=resolved_slug,
                payment_option=payment_option,
            )
            # Build a detail-rich confirmation
            price_label = {
                "upfront": f"${course['upfront_price']:,} (full price)",
                "discounted": f"${course['discounted_price']:,} (discounted)",
                "early_bird": f"${course['early_bird_price']:,} (early bird — save ${course['early_bird_save']})",
                "installment": f"${course['installment']['down_payment']} down + ${course['installment']['monthly']}/mo for {course['installment']['months']} months (${course['installment']['total']:,} total)",
                "scholarship": f"${course['discounted_price']:,} (before scholarship discount)",
            }
            price_str = price_label.get(payment_option, f"${booking.amount_due:,.0f}")

            return (
                f"✅ **Enrollment confirmed!**\n\n"
                f"**Booking ID:** {booking.booking_id}\n"
                f"**Student:** {booking.student_name}\n"
                f"**Course:** {booking.course_title}\n"
                f"**Amount:** {price_str}\n"
                f"**Status:** {booking.status}\n\n"
                f"A confirmation email will be sent to {booking.email} with next steps.\n"
                f"Your cohort starts: {course['next_cohort']}\n\n"
                f"📌 For scholarship applications or payment changes, contact support@devnestacademy.com "
                f"with your booking ID."
            )
        except ValueError as e:
            return f"Sorry, I couldn't process the enrollment: {e}"

    def _run(self, **kwargs) -> str:
        raise NotImplementedError("Use async only")


# ── Tool Registry ─────────────────────────────────────────────

def get_all_tools() -> list[BaseTool]:
    """Return all agent tools."""
    return [
        SearchCoursesTool(),
        GetCourseDetailsTool(),
        SearchFAQsTool(),
        GetPricingTool(),
        GetScholarshipsTool(),
        GetFeeStructureTool(),
        BookCourseTool(),
    ]
