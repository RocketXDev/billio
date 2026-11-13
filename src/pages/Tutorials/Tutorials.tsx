import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaPlay, FaTimes } from "react-icons/fa";
import { supabase } from "../../lib/supabaseClient";
import {
  ALL_TUTORIALS,
  TUTORIAL_SECTIONS,
  formatLength,
  tutorialFile,
  type Tutorial,
} from "../../content/tutorials";
import "./Tutorials.css";

// Public, like the blog: linked from the landing page and from More. A video
// only downloads once someone opens it; /tutorials#<slug> opens that one.
export default function Tutorials() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [openSlug, setOpenSlug] = useState<string | null>(() => {
    const slug = window.location.hash.slice(1);
    return ALL_TUTORIALS.some((t) => t.slug === slug) ? slug : null;
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session)).catch(() => {});
  }, []);

  const open = (slug: string | null) => {
    setOpenSlug(slug);
    window.history.replaceState(null, "", slug ? `#${slug}` : window.location.pathname);
  };

  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  const current = ALL_TUTORIALS.find((t) => t.slug === openSlug) ?? null;
  const next = current ? ALL_TUTORIALS[ALL_TUTORIALS.indexOf(current) + 1] ?? null : null;

  return (
    <div className="blog-page tut-page">
      <header className="blog-header">
        <div className="blog-header-inner">
          <div className="blog-header-left">
            <button type="button" className="up-back-btn" onClick={goBack} aria-label="Back">
              <FaArrowLeft />
            </button>
            <img src="/logo-white.png" alt="Billio" className="about-logo" />
          </div>
          {!signedIn && (
            <div className="blog-header-actions">
              <Link to="/login" className="blog-nav-login">Login</Link>
              <Link to="/signup" className="blog-nav-cta">Get Started</Link>
            </div>
          )}
        </div>
      </header>

      <section className="blog-hero-band">
        <div className="blog-hero">
          <span className="blog-label">Tutorials</span>
          <h1 className="blog-hero-title">See how Billio works.</h1>
          <p className="blog-hero-subtitle">
            Short videos for everything from your first lesson to getting paid. Most take under 30 seconds.
          </p>
        </div>
      </section>

      <main className="tut-body">
        {TUTORIAL_SECTIONS.map((section) => (
          <section key={section.title} className="tut-section">
            <h2 className="tut-section-title">{section.title}</h2>
            <div className="tut-grid">
              {section.tutorials.map((tutorial) => (
                <TutorialCard key={tutorial.slug} tutorial={tutorial} onOpen={() => open(tutorial.slug)} />
              ))}
            </div>
          </section>
        ))}

        {!signedIn && (
          <div className="tut-cta">
            <h2>Ready to try it?</h2>
            <p>Start free with up to 5 active students. No credit card required.</p>
            <Link to="/signup" className="tut-cta-btn">
              Start Free <FaArrowRight />
            </Link>
          </div>
        )}
      </main>

      <footer className="blog-page-footer">
        <div className="blog-page-footer-links">
          <Link to="/about">About</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/support">Support</Link>
        </div>
        <p>© {new Date().getFullYear()} Billio LLC. All rights reserved.</p>
      </footer>

      {current && (
        <TutorialPlayer
          tutorial={current}
          next={next}
          onNext={() => next && open(next.slug)}
          onClose={() => open(null)}
        />
      )}
    </div>
  );
}

function TutorialCard({ tutorial, onOpen }: { tutorial: Tutorial; onOpen: () => void }) {
  return (
    <button type="button" className="tut-card" onClick={onOpen} aria-label={`Play ${tutorial.title}`}>
      <span className="tut-thumb">
        <img src={tutorialFile(tutorial.slug, "jpg")} alt="" loading="lazy" />
        <span className="tut-play" aria-hidden="true"><FaPlay /></span>
        <span className="tut-length">{formatLength(tutorial.seconds)}</span>
      </span>
      <span className="tut-card-body">
        <strong>{tutorial.title}</strong>
        <span>{tutorial.description}</span>
      </span>
    </button>
  );
}

function TutorialPlayer({ tutorial, next, onNext, onClose }: {
  tutorial: Tutorial;
  next: Tutorial | null;
  onNext: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="tut-player-overlay" onClick={onClose}>
      <div
        className="tut-player"
        role="dialog"
        aria-modal="true"
        aria-label={tutorial.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tut-player-head">
          <strong>{tutorial.title}</strong>
          <button type="button" className="tut-player-close" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>
        <video
          key={tutorial.slug}
          className="tut-video"
          src={tutorialFile(tutorial.slug, "mp4")}
          poster={tutorialFile(tutorial.slug, "jpg")}
          controls
          autoPlay
          playsInline
          preload="metadata"
        />
        {next && (
          <button type="button" className="tut-player-next" onClick={onNext}>
            Next: {next.title} <FaArrowRight />
          </button>
        )}
      </div>
    </div>
  );
}
