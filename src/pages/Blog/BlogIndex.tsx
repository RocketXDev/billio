import { useNavigate, Link } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaRegClock } from "react-icons/fa";
import { BLOG_POSTS } from "../../content/blogPosts";
import "./Blog.css";

export default function BlogIndex() {
  const navigate = useNavigate();

  return (
    <div className="blog-page">
      <header className="blog-header">
        <div className="blog-header-inner">
          <div className="blog-header-left">
            <button type="button" className="up-back-btn" onClick={() => navigate(-1)}>
              <FaArrowLeft />
            </button>
            <img src="/logo-white.png" alt="Billio" className="about-logo" />
          </div>
          <div className="blog-header-actions">
            <Link to="/login" className="blog-nav-login">Login</Link>
            <Link to="/signup" className="blog-nav-cta">Get Started</Link>
          </div>
        </div>
      </header>

      <section className="blog-hero-band">
        <div className="blog-hero">
          <span className="blog-label">Billio Blog</span>
          <h1 className="blog-hero-title">Practical advice for running a teaching practice.</h1>
          <p className="blog-hero-subtitle">
            Scheduling, billing, and admin advice for coaches, tutors, instructors, and music educators
            who'd rather spend their time teaching.
          </p>
        </div>
      </section>

      <section className="blog-index-section">
        <div className="blog-index-grid">
          {BLOG_POSTS.map((post) => (
            <Link to={`/blog/${post.slug}`} className="blog-card" key={post.slug}>
              <div className="blog-card-image">
                <img src={post.heroImage} alt={post.heroImageAlt} loading="lazy" />
                <span className="blog-card-tag">{post.tag}</span>
              </div>
              <div className="blog-card-body">
                <h2>{post.title}</h2>
                <p>{post.excerpt}</p>
                <div className="blog-card-meta">
                  <span>{formatDate(post.publishedAt)}</span>
                  <span className="blog-card-meta-dot">•</span>
                  <span><FaRegClock /> {post.readTime}</span>
                </div>
                <span className="blog-card-readmore">
                  Read article <FaArrowRight />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="blog-page-footer">
        <div className="blog-page-footer-links">
          <Link to="/about">About</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/support">Support</Link>
        </div>
        <p>© {new Date().getFullYear()} Billio LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
