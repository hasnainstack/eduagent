"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  Award, BarChart3, BookOpen, Briefcase, Cloud, Cpu, CreditCard,
  Globe, MessageCircle, Palette, Star, User, Users, ShoppingCart,
  LogIn, ArrowRight, ChevronDown,
} from "lucide-react";

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Data ─────────────────────────────────────────────────────── */

const COURSES = [
  {
    slug: "fullstack-web-bootcamp",
    title: "Full-Stack Web Development Bootcamp",
    tagline: "From zero to job-ready full-stack developer",
    description: "Master HTML, CSS, JavaScript, React, Node.js, and databases. Build real-world projects and deploy them to production. No prior coding experience needed.",
    duration: "16 weeks",
    level: "Beginner",
    price: "$999",
    originalPrice: "$1,299",
    cohort: "July 14, 2026",
    skills: ["React", "Node.js", "TypeScript", "PostgreSQL", "Docker"],
    highlights: ["Land a junior dev job", "5 real portfolio projects", "Career coaching included"],
  },
  {
    slug: "data-science-masterclass",
    title: "Data Science Masterclass",
    tagline: "Turn data into decisions",
    description: "Learn Python, pandas, SQL, machine learning, and data visualization. Work with real datasets and build ML models from scratch.",
    duration: "12 weeks",
    level: "Intermediate",
    price: "$1,199",
    originalPrice: "$1,499",
    cohort: "August 4, 2026",
    skills: ["Python", "Pandas", "Scikit-learn", "SQL", "Power BI"],
    highlights: ["Work with real datasets", "ML model deployment", "Portfolio projects"],
  },
  {
    slug: "aiml-engineering",
    title: "AI/ML Engineering Program",
    tagline: "Build the next generation of intelligent systems",
    description: "Deep dive into neural networks, NLP, computer vision, LLMs, and MLOps. Train and deploy models at scale using cloud infrastructure.",
    duration: "14 weeks",
    level: "Advanced",
    price: "$1,399",
    originalPrice: "$1,699",
    cohort: "September 1, 2026",
    skills: ["PyTorch", "TensorFlow", "LLMs", "MLOps", "AWS"],
    highlights: ["GPU computing access", "LLM fine-tuning project", "Research paper review"],
  },
  {
    slug: "uiux-design",
    title: "UI/UX Design Certificate",
    tagline: "Design products people love",
    description: "Learn design thinking, wireframing, prototyping, user research, and Figma. Build a stunning portfolio from real-world briefs.",
    duration: "8 weeks",
    level: "Beginner",
    price: "$599",
    originalPrice: "$799",
    cohort: "July 21, 2026",
    skills: ["Figma", "User Research", "Prototyping", "Design Systems", "HTML/CSS"],
    highlights: ["Portfolio-ready projects", "Design certification", "Client brief simulations"],
  },
  {
    slug: "devops-cloud",
    title: "DevOps & Cloud Engineering",
    tagline: "Ship faster, scale infinitely",
    description: "Master CI/CD pipelines, Docker, Kubernetes, AWS, monitoring, and infrastructure as code. Deploy and manage production-grade systems.",
    duration: "10 weeks",
    level: "Intermediate",
    price: "$799",
    originalPrice: "$999",
    cohort: "August 18, 2026",
    skills: ["Docker", "Kubernetes", "AWS", "Terraform", "CI/CD"],
    highlights: ["Live infrastructure projects", "AWS practice environment", "Certification prep"],
  },
];

const FEATURES = [
  {
    title: "Industry-Driven Curriculum",
    description: "Courses designed with hiring partners to teach exactly what the industry needs. Updated every quarter.",
  },
  {
    title: "Expert Mentors",
    description: "Learn from senior engineers and designers working at top tech companies. Weekly 1-on-1 mentorship sessions.",
  },
  {
    title: "Career Support",
    description: "Resume reviews, mock interviews, portfolio building, and job placement assistance with our hiring network.",
  },
  {
    title: "Flexible Payments",
    description: "Upfront, installment plans, early bird discounts, and scholarships. Quality education shouldn't break the bank.",
  },
  {
    title: "Global Community",
    description: "Join 2,000+ alumni across 30 countries. Network with peers, attend hackathons, and grow your professional circle.",
  },
  {
    title: "Certificates & Recognition",
    description: "Earn industry-recognized certificates upon completion. Added directly to your LinkedIn profile.",
  },
];

const STATS = [
  { value: "2,000+", label: "Students Trained" },
  { value: "92%", label: "Placement Rate" },
  { value: "30+", label: "Countries" },
  { value: "4.8 / 5", label: "Average Rating" },
];

const TESTIMONIALS = [
  {
    name: "Ahmed Raza",
    role: "Full-Stack Bootcamp Graduate",
    text: "DevNest changed my life. I went from knowing zero code to landing a job as a junior developer in 4 months. The mentorship was incredible.",
  },
  {
    name: "Fatima Khan",
    role: "Data Science Alumna",
    text: "The data science program was rigorous and practical. I built real ML models and had a job offer before graduation. Highly recommended!",
  },
  {
    name: "Usman Ali",
    role: "AI/ML Graduate",
    text: "The AI/ML program gave me hands-on experience with LLMs and computer vision that most bootcamps don't offer. World-class curriculum.",
  },
];

const FAQS = [
  { q: "Who can apply?", a: "Anyone! No prior tech experience needed for beginner courses. Advanced courses may require foundation knowledge. We assess each applicant individually." },
  { q: "How do payments work?", a: "You can pay upfront (best value), use our 3-month installment plan, or subscribe monthly. Early bird discounts save $100–$200, and scholarships can reduce fees up to 50%." },
  { q: "What if I'm not satisfied?", a: "We offer a 7-day full refund policy from cohort start. Within 14 days, you get a 50% refund. No questions asked." },
  { q: "Are courses online or in-person?", a: "All courses are fully online with live sessions, recorded lectures, and 1-on-1 mentoring. Learn from anywhere in the world." },
  { q: "Do you offer job placement?", a: "Yes! Pro Plus students get job placement support, resume reviews, and access to our hiring partner network. Our overall placement rate is 92% within 6 months of graduation." },
  { q: "Can I switch courses after enrolling?", a: "Yes, within the first 7 days. We want you in the right program for your goals. Just contact support." },
];

/* ── Components ────────────────────────────────────────────────── */

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { user, token, logout, isAdmin } = useAuth();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "bg-white/95 backdrop-blur-md shadow-sm" : "bg-transparent"
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">🦉</span>
          <span className="font-bold text-lg text-brand-900">DevNest</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6">
          <a href="#courses" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">Courses</a>
          <a href="#about" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">Why DevNest</a>
          <a href="#faq" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">FAQ</a>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link href="/cart" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">Cart</Link>
              <Link href="/dashboard" className="text-sm text-gray-600 hover:text-brand-600 transition-colors">Dashboard</Link>
              {isAdmin && <Link href="/admin" className="text-sm text-brand-600 font-semibold hover:text-brand-700 transition-colors">Admin</Link>}
              <button
                onClick={logout}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors"
            >
              Login
            </Link>
          )}
          <Link
            href="/chat"
            className="px-5 py-2 rounded-full bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold shadow-lg shadow-brand-500/25 transition-all duration-200 hover:shadow-xl hover:shadow-brand-500/30"
          >
            Chat with Nova
          </Link>
        </div>
      </div>
    </nav>
  );
}

function FloatingChatButton() {
  return (
    <Link
      href="/chat"
      className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl shadow-brand-500/30 flex items-center justify-center transition-all duration-200 hover:scale-110 hover:shadow-2xl hover:shadow-brand-500/40"
      aria-label="Chat with Nova"
    >
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    </Link>
  );
}

/* ── Sections ──────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand-100/50 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-brand-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center pt-24 pb-16">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-xs font-medium mb-8">
            Now accepting applications for Summer 2026 cohorts
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-brand-900 leading-tight mb-6">
          Master Tech Skills<br />
          <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">
            Build Your Future
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-10 leading-relaxed">
          DevNest Academy offers industry-driven tech courses with live mentorship,
          real-world projects, and career support. From beginner to job-ready in weeks, not years.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/chat"
            className="px-8 py-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-lg shadow-xl shadow-brand-500/30 transition-all duration-200 hover:shadow-2xl hover:shadow-brand-500/40 hover:-translate-y-0.5"
          >
            <MessageCircle className="w-5 h-5" /> Talk to Nova — Your AI Advisor
          </Link>
          <a
            href="#courses"
            className="px-8 py-4 rounded-2xl bg-white border-2 border-brand-200 hover:border-brand-400 text-brand-700 font-semibold text-lg transition-all duration-200 hover:-translate-y-0.5"
          >
            Browse Courses
          </a>
        </div>
        <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-400">
          <span>No prior experience needed</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Scholarships available</span>
          <span className="hidden sm:inline">·</span>
          <span>Fully online</span>
        </div>
      </div>
    </section>
  );
}

function Stats() {
  return (
    <section className="py-16 bg-brand-900">
      <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {STATS.map((s, i) => (
          <div key={i}>
            <div className="text-3xl sm:text-4xl font-bold text-white mb-1">{s.value}</div>
            <div className="text-sm text-brand-300">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const courseIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "fullstack-web-bootcamp": Globe,
  "data-science-masterclass": BarChart3,
  "aiml-engineering": Cpu,
  "uiux-design": Palette,
  "devops-cloud": Cloud,
};

const featureIcons = [BookOpen, Users, Briefcase, CreditCard, Globe, Award];

function Courses() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [courseIds, setCourseIds] = useState<Record<string, number>>({});
  const [addingToCart, setAddingToCart] = useState<string | null>(null);
  const [cartFeedback, setCartFeedback] = useState("");
  const { token } = useAuth();

  useEffect(() => {
    fetch(`${BASE}/api/courses`)
      .then(res => res.json())
      .then(data => {
        const map: Record<string, number> = {};
        for (const c of data.courses || []) {
          map[c.slug] = c.id;
        }
        setCourseIds(map);
      })
      .catch(() => {});
  }, []);

  const handleAddToCart = async (slug: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!token) {
      setCartFeedback("Please login first");
      setTimeout(() => setCartFeedback(""), 3000);
      return;
    }
    const courseId = courseIds[slug];
    if (!courseId) return;
    setAddingToCart(slug);
    setCartFeedback("");
    try {
      const res = await fetch(`${BASE}/user/cart`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ course_id: courseId }),
      });
      const data = await res.json();
      if (res.ok) {
        setCartFeedback(`Added "${COURSES.find(c => c.slug === slug)?.title}" to cart!`);
      } else {
        setCartFeedback(data.detail?.includes("already") ? "Already in cart" : `${data.detail || "Failed"}`);
      }
    } catch {
      setCartFeedback("Network error");
    } finally {
      setAddingToCart(null);
      setTimeout(() => setCartFeedback(""), 3000);
    }
  };

  return (
    <section id="courses" className="py-20 bg-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-brand-900 mb-4">Our Courses</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Choose from 5 industry-aligned programs designed to take you from wherever you are to where you want to be.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cart feedback banner */}
          {cartFeedback && (
            <div className={`md:col-span-2 lg:col-span-3 px-4 py-3 rounded-xl text-sm font-medium text-center ${
              cartFeedback.startsWith("Added") ? "bg-green-50 text-green-700 border border-green-200"
              : cartFeedback.startsWith("Already") ? "bg-yellow-50 text-yellow-700 border border-yellow-200"
              : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {cartFeedback}
            </div>
          )}
          {COURSES.map((c) => (
            <div
              key={c.slug}
              className={`rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                expanded === c.slug
                  ? "border-brand-400 shadow-xl shadow-brand-500/10 scale-[1.02]"
                  : "border-brand-100 hover:border-brand-300 hover:shadow-lg"
              } bg-white`}
              onClick={() => setExpanded(expanded === c.slug ? null : c.slug)}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <span className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600">
                    {(() => {
                      const Icon = courseIconMap[c.slug];
                      return Icon ? <Icon className="w-5 h-5" /> : null;
                    })()}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    c.level === "Beginner" ? "bg-green-100 text-green-700" :
                    c.level === "Intermediate" ? "bg-yellow-100 text-yellow-700" :
                    "bg-red-100 text-red-700"
                  }`}>
                    {c.level}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-brand-900 mb-1">{c.title}</h3>
                <p className="text-sm text-gray-500 mb-3">{c.tagline}</p>

                {/* Compact info */}
                <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                  <span>{c.duration}</span>
                  <span>{c.cohort}</span>
                </div>

                {/* Pricing */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-2xl font-bold text-brand-700">{c.price}</span>
                  <span className="text-sm text-gray-400 line-through">{c.originalPrice}</span>
                </div>
                {token ? (
                  <button
                    onClick={(e) => handleAddToCart(c.slug, e)}
                    disabled={addingToCart === c.slug}
                    className="w-full px-3 py-2 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-semibold border border-brand-200 transition-all duration-200 disabled:opacity-50 mb-4"
                  >
                    {addingToCart === c.slug ? "Adding..." : <><ShoppingCart className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> Add to Cart</>}
                  </button>
                ) : (
                  <Link
                    href="/login"
                    className="block w-full text-center px-3 py-2 rounded-lg bg-gray-50 hover:bg-brand-50 text-gray-500 hover:text-brand-700 text-xs font-semibold border border-gray-200 hover:border-brand-200 transition-all duration-200 mb-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <LogIn className="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" /> Login to Enroll
                  </Link>
                )}

                {/* Expanded content */}
                {expanded === c.slug && (
                  <div className="border-t border-brand-100 pt-4 mt-2 space-y-4">
                    <p className="text-sm text-gray-600 leading-relaxed">{c.description}</p>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Technologies:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {c.skills.map((s) => (
                          <span key={s} className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs rounded-full font-medium">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      {c.highlights.map((h, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-brand-500">✦</span> {h}
                        </div>
                      ))}
                    </div>
                    <Link
                      href="/chat"
                      className="block text-center mt-3 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-all duration-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageCircle className="w-4 h-4 inline-block mr-1.5 -mt-0.5" /> Ask Nova about this course</Link>
                  </div>
                )}

                {expanded !== c.slug && (
                  <p className="text-xs text-brand-500 font-medium"><ArrowRight className="w-3 h-3 inline-block mr-0.5 -mt-0.5" /> Click to expand details</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <p className="text-sm text-gray-400 mb-4">Not sure which course fits you?</p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold transition-all duration-200"
          >
            <MessageCircle className="w-4 h-4" /> Let Nova guide you
          </Link>
        </div>
      </div>
    </section>
  );
}

function WhyDevNest() {
  return (
    <section id="about" className="py-20 bg-gradient-to-b from-brand-50 to-white">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-brand-900 mb-4">Why DevNest Academy?</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            We&apos;re not just another online course platform. Here&apos;s what makes us different.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => {
            const FeatIcon = featureIcons[i];
            return (
              <div key={i} className="p-6 rounded-2xl bg-white border border-brand-100 hover:shadow-lg hover:border-brand-200 transition-all duration-300">
                <span className="w-11 h-11 rounded-xl bg-brand-100 flex items-center justify-center text-brand-600 mb-3">
                  <FeatIcon className="w-5 h-5" />
                </span>
                <h3 className="text-lg font-bold text-brand-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-brand-900 mb-4">What Our Students Say</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="p-6 rounded-2xl bg-brand-50 border border-brand-100">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-500">
                  <User className="w-5 h-5" />
                </span>
                <div>
                  <p className="font-bold text-brand-900 text-sm">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.role}</p>
                </div>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed italic">&ldquo;{t.text}&rdquo;</p>
              <div className="mt-3 flex items-center gap-0.5 text-brand-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section id="faq" className="py-20 bg-gradient-to-b from-white to-brand-50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-bold text-brand-900 mb-4">Frequently Asked Questions</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((item, i) => (
            <div key={i} className="rounded-xl border border-brand-100 bg-white overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 text-left text-sm font-semibold text-brand-900 hover:bg-brand-50 transition-colors"
                onClick={() => setOpen(open === item.q ? null : item.q)}
              >
                {item.q}
                <span className={`text-brand-400 transition-transform ${open === item.q ? "rotate-180" : ""}`}>
                  <ChevronDown className="w-4 h-4" />
                </span>
              </button>
              {open === item.q && (
                <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{item.a}</div>
              )}
            </div>
          ))}
        </div>
        <div className="text-center mt-8">
          <p className="text-sm text-gray-400">
            Still have questions?{" "}
            <Link href="/chat" className="text-brand-600 font-semibold hover:underline">
              Ask Nova
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-900 text-white py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid sm:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🦉</span>
              <span className="font-bold text-lg">DevNest Academy</span>
            </div>
            <p className="text-sm text-brand-300 leading-relaxed">
              Empowering the next generation of tech talent with industry-driven education, mentorship, and career support.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Quick Links</h4>
            <div className="space-y-2 text-sm text-brand-300">
              <a href="#courses" className="block hover:text-white transition-colors">Courses</a>
              <a href="#about" className="block hover:text-white transition-colors">Why DevNest</a>
              <a href="#faq" className="block hover:text-white transition-colors">FAQ</a>
              <Link href="/chat" className="block hover:text-white transition-colors">Chat with Nova</Link>
              <Link href="/voice" className="block hover:text-white transition-colors">Voice Demo</Link>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Contact</h4>
            <div className="space-y-2 text-sm text-brand-300">
              <p>support@devnestacademy.com</p>
              <p>devnestacademy.com</p>
              <p>Pakistan — serving students worldwide</p>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-sm mb-3">Admin</h4>
            <div className="space-y-2 text-sm text-brand-300">
              <Link href="/admin" className="block hover:text-white transition-colors">Admin Dashboard</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-brand-800 pt-6 text-center text-xs text-brand-400">
          © {new Date().getFullYear()} DevNest Academy. All rights reserved. Built for the tech community.
        </div>
      </div>
    </footer>
  );
}

/* ── Page ──────────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <Stats />
      <Courses />
      <WhyDevNest />
      <Testimonials />
      <FAQ />
      <Footer />
      <FloatingChatButton />
    </main>
  );
}
