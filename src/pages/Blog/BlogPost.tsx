import { useEffect } from "react";
import { useNavigate, useParams, Link, Navigate } from "react-router-dom";
import { FaArrowLeft, FaArrowRight, FaRegClock, FaCheckCircle, FaHeart } from "react-icons/fa";
import { getBlogPost } from "../../content/blogPosts";
import "./Blog.css";

const SITE_URL = "https://www.mybillioapp.com";

export default function BlogPost() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const post = getBlogPost(slug);

  useEffect(() => {
    if (!post) return;

    document.title = post.metaTitle;
    const descTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (descTag) descTag.setAttribute("content", post.metaDescription);
    const ogTitle = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", post.metaTitle);
    const ogDesc = document.querySelector<HTMLMetaElement>('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", post.metaDescription);

    const postUrl = `${SITE_URL}/blog/${post.slug}`;
    const articleSchema = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.metaDescription,
      image: post.heroImage,
      datePublished: post.publishedAt,
      dateModified: post.publishedAt,
      author: { "@type": "Person", name: post.author.name },
      publisher: {
        "@type": "Organization",
        name: "Billio",
        logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": postUrl },
    };

    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: post.faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    };

    const articleScript = document.createElement("script");
    articleScript.type = "application/ld+json";
    articleScript.text = JSON.stringify(articleSchema);
    articleScript.dataset.blogSchema = "article";
    document.head.appendChild(articleScript);

    const faqScript = document.createElement("script");
    faqScript.type = "application/ld+json";
    faqScript.text = JSON.stringify(faqSchema);
    faqScript.dataset.blogSchema = "faq";
    document.head.appendChild(faqScript);

    return () => {
      articleScript.remove();
      faqScript.remove();
    };
  }, [post]);

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

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

      <section className="blog-post-hero-band">
        <div className="blog-post-hero">
          <span className="blog-label">{post.tag}</span>
          <h1 className="blog-post-title">{post.title}</h1>
          <p className="blog-post-excerpt">{post.excerpt}</p>
          <div className="blog-post-byline">
            <span className="blog-author-avatar">{post.author.name.charAt(0)}</span>
            <div className="blog-byline-text">
              <strong>{post.author.name}</strong>
              <span>{post.author.role}</span>
            </div>
            <span className="blog-byline-dot">•</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span className="blog-byline-dot">•</span>
            <span><FaRegClock /> {post.readTime}</span>
          </div>
        </div>
      </section>

      <article className="blog-post-article">
        <figure className="blog-post-hero-image">
          <img src={post.heroImage} alt={post.heroImageAlt} />
        </figure>

        <div className="blog-key-takeaways">
          <strong>Key takeaways</strong>
          <ul>
            {post.keyTakeaways.map((point) => (
              <li key={point}>
                <FaCheckCircle /> <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <nav className="blog-toc" aria-label="Table of contents">
          {post.toc.map((item) => (
            <a key={item.id} href={`#${item.id}`}>{item.label}</a>
          ))}
        </nav>

        <div className="blog-post-body">
          <post.Content />
        </div>

        <div className="blog-faq-section" id="faq">
          <h2>Frequently asked questions</h2>
          <div className="blog-faq-list">
            {post.faq.map((item) => (
              <div className="blog-faq-item" key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        {/* <div className="blog-author-card">
          <span className="blog-author-avatar blog-author-avatar-lg">{post.author.name.charAt(0)}</span>
          <div>
            <strong>{post.author.name}</strong>
            <span>{post.author.role}</span>
            <p>Building Billio to take the admin out of running a teaching practice.</p>
          </div>
        </div> */}

        <div className="blog-post-cta">
          <h2>Ready to spend less time on admin?</h2>
          <p>Start free, no credit card needed — upgrade to Pro whenever you're ready.</p>
          <Link to="/signup" className="blog-post-cta-btn">
            Get Started Free <FaArrowRight />
          </Link>
        </div>
      </article>

      <footer className="blog-page-footer">
        <div className="blog-page-footer-links">
          <Link to="/blog">All Articles</Link>
          <Link to="/about">About</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/support">Support</Link>
        </div>
        <p>
          <FaHeart style={{ color: "var(--primary-purple)", fontSize: 12, marginRight: 5 }} />
          Made for coaches, by people who care about your time.
        </p>
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
