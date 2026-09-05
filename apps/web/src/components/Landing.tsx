import { useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { HeroCanvas } from "./HeroCanvas";
import { SplitHeading } from "./SplitHeading";
import { ClapperboardMark } from "./ClapperboardMark";
import { CountdownLeader } from "./CountdownLeader";

const CONTINUITY_TAGS = ["WARDROBE", "TIMELINE", "PROPS", "GEOGRAPHY", "FACTS"];

gsap.registerPlugin(ScrollTrigger);

interface LandingProps {
  onLaunch: () => void;
}

const PROBLEMS = [
  {
    icon: "solar:hanger-2-bold",
    title: "Wardrobe & props drift",
    body: "A bandage moves arms between scenes. A prop vanishes with no line cutting it. Nobody catches it until dailies.",
  },
  {
    icon: "solar:clock-circle-bold",
    title: "Timeline breaks",
    body: "“DAY” becomes “NIGHT” ten pages later with no elapsed time to justify it — and no one reads closely enough to notice.",
  },
  {
    icon: "solar:global-bold",
    title: "Facts that don't hold up",
    body: "A period piece hands a character tech that didn't exist yet. It reads fine until an audience — or a critic — checks the date.",
  },
];

const PIPELINE = [
  {
    icon: "solar:document-add-bold",
    title: "Parse",
    body: "Fountain, plaintext, Final Draft, or a plain PDF — indexed into scenes, characters, and lines in seconds.",
  },
  {
    icon: "solar:shield-check-bold",
    title: "Continuity",
    body: "Every scene is cross-checked against everything that came before it: wardrobe, props, timeline, geography.",
  },
  {
    icon: "solar:radar-2-bold",
    title: "Fact-check",
    body: "Claims that depend on the real world are verified against live web sources, with citations attached.",
  },
  {
    icon: "solar:list-check-bold",
    title: "Triage",
    body: "Issues rank by severity and confidence. Investigate, confirm, or dismiss — with a reason that sticks.",
  },
];

export function Landing({ onLaunch }: LandingProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      let lenis: Lenis | undefined;

      if (!reduceMotion) {
        lenis = new Lenis({ duration: 1.05, smoothWheel: true });
        lenis.on("scroll", ScrollTrigger.update);
        gsap.ticker.add((time) => lenis!.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
      }

      // hero intro: nav, headline words, sub copy, CTAs settle in sequence
      const heroTl = gsap.timeline({ defaults: { ease: "power3.out" } });
      heroTl
        .from(".site-header", { y: -24, opacity: 0, duration: 0.6 })
        .from(
          ".hero-title .word",
          { y: "110%", opacity: 0, duration: 0.85, stagger: 0.045 },
          "-=0.25",
        )
        .from(".hero-sub", { y: 16, opacity: 0, duration: 0.6 }, "-=0.45")
        .from(".hero-cta-row > *", { y: 12, opacity: 0, duration: 0.5, stagger: 0.08 }, "-=0.35")
        .from(".hero-scroll-cue", { opacity: 0, duration: 0.6 }, "-=0.2");

      // section headings reveal word-by-word as they enter
      document.querySelectorAll<HTMLElement>(".section-title").forEach((title) => {
        gsap.from(title.querySelectorAll(".word"), {
          y: "60%",
          opacity: 0,
          duration: 0.6,
          stagger: 0.03,
          ease: "power2.out",
          scrollTrigger: { trigger: title, start: "top 85%" },
        });
      });

      gsap.utils.toArray<HTMLElement>(".problem-card").forEach((card, i) => {
        const icon = card.querySelector(".problem-card-icon");
        const tl = gsap.timeline({
          delay: i * 0.06,
          scrollTrigger: { trigger: card, start: "top 88%" },
        });
        tl.from(card, { y: 28, opacity: 0, duration: 0.6, ease: "power2.out" });
        if (icon) {
          tl.from(
            icon,
            { scale: 0.4, rotate: -8, opacity: 0, duration: 0.5, ease: "back.out(2.4)" },
            "-=0.4",
          );
        }
      });

      gsap.utils.toArray<HTMLElement>(".pipeline-step").forEach((step, i) => {
        const icon = step.querySelector(".pipeline-step-icon");
        const tl = gsap.timeline({
          delay: i * 0.08,
          scrollTrigger: { trigger: step, start: "top 88%" },
        });
        tl.from(step, { y: 28, opacity: 0, duration: 0.6, ease: "power2.out" });
        if (icon) {
          tl.from(
            icon,
            { scale: 0.4, rotate: 10, opacity: 0, duration: 0.5, ease: "back.out(2.4)" },
            "-=0.4",
          );
        }
      });

      gsap.from(".preview-frame", {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: { trigger: ".preview-frame", start: "top 85%" },
      });

      gsap.from(".cta-title, .cta-row", {
        y: 24,
        opacity: 0,
        duration: 0.7,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: { trigger: ".cta-section", start: "top 80%" },
      });

      return () => {
        lenis?.destroy();
      };
    }, rootRef);

    const refreshOnLoad = () => ScrollTrigger.refresh();
    window.addEventListener("load", refreshOnLoad);

    return () => {
      window.removeEventListener("load", refreshOnLoad);
      ctx.revert();
    };
  }, []);

  return (
    <div className="landing" ref={rootRef}>
      <div className="grain" />
      <div className="filmstrip-rail left" />
      <div className="filmstrip-rail right" />

      <header className="site-header">
        <span className="brand">
          <ClapperboardMark size={26} />
          <span className="brand-mark">Ross</span>
        </span>
        <nav className="nav-links">
          <span className="nav-links-secondary">
            <a href="#problem">Why it matters</a>
          </span>
          <span className="nav-links-secondary">
            <a href="#pipeline">How it works</a>
          </span>
          <button className="btn btn-primary" onClick={onLaunch}>
            Launch the app
            <Icon icon="solar:arrow-right-up-bold" className="icon" width={16} />
          </button>
        </nav>
      </header>

      <section className="hero">
        <HeroCanvas />
        <div className="hero-vignette" />
        <div className="hero-inner">
          <p className="eyebrow">Agentic script supervisor</p>
          <SplitHeading
            as="h1"
            className="hero-title"
            text="Catch the slip before the crew does."
            accentWords={["slip"]}
          />
          <p className="hero-sub">
            Ross reads a screenplay the way a script supervisor would — tracking wardrobe,
            props, and timeline across every scene — then checks the claims that depend on
            the real world against live sources.
          </p>
          <div className="hero-cta-row">
            <button className="btn btn-primary" onClick={onLaunch}>
              <Icon icon="solar:document-text-bold" className="icon" width={18} />
              Analyze a script
            </button>
            <a className="btn btn-ghost" href="#pipeline">
              See how it works
            </a>
            <span className="hero-cta-note">Fountain · Plaintext · Final Draft · PDF</span>
          </div>
        </div>
        <div className="hero-scroll-cue">
          <span className="hero-scroll-cue-line" />
          Scroll
        </div>
      </section>

      <div className="reel-divider">
        <CountdownLeader size={52} />
        <div className="marquee">
          <div className="marquee-track">
            {CONTINUITY_TAGS.concat(CONTINUITY_TAGS).map((tag, i) => (
              <span key={i}>{tag} —</span>
            ))}
          </div>
        </div>
        <span className="reel-divider-label">Cut to:</span>
      </div>

      <section className="section" id="problem">
        <div className="section-head">
          <p className="section-label">The problem</p>
          <SplitHeading
            as="h2"
            className="section-title"
            text="Small slips read fine on the page and break on set."
          />
          <p className="section-body">
            A writers' room reads for story, not for whether a bandage survived three
            drafts. By the time these slips surface, they're expensive to fix.
          </p>
        </div>
        <div className="problem-grid">
          {PROBLEMS.map((p) => (
            <div className="problem-card" key={p.title}>
              <Icon icon={p.icon} className="problem-card-icon" />
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="pipeline">
        <div className="section-head">
          <p className="section-label">The pipeline</p>
          <SplitHeading as="h2" className="section-title" text="Four passes, one upload." />
          <p className="section-body">
            Upload once. Ross parses the script, layers in continuity checks, sends
            real-world claims out for verification, and hands you a ranked, actionable list.
          </p>
        </div>
        <div className="pipeline-track">
          {PIPELINE.map((step, i) => (
            <div className="pipeline-step" key={step.title}>
              <span className="pipeline-step-index">0{i + 1}</span>
              <Icon icon={step.icon} className="pipeline-step-icon" width={26} height={26} />
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="preview">
        <div className="section-head">
          <p className="section-label">The workspace</p>
          <SplitHeading as="h2" className="section-title" text="Every issue, tied to its scene." />
          <p className="section-body">
            Click an issue and the script view jumps to the exact scenes it touches, evidence
            and sources included. This is the actual app — not a mockup.
          </p>
        </div>
        <div className="preview-frame">
          <div className="preview-chrome">
            <span className="preview-dot" />
            <span className="preview-dot" />
            <span className="preview-dot" />
            <span className="muted mono" style={{ fontSize: "0.75rem" }}>
              the-long-way-home.fountain
            </span>
          </div>
          <div className="preview-body">
            <div className="preview-script">
              <p className="heading">12. INT. HENDERSON OFFICE — DAY</p>
              <p>
                Sarah adjusts the <span className="flagged">bandage on her left arm</span> and
                sits across from HENDERSON.
              </p>
              <p className="heading">14. EXT. STREET — NIGHT</p>
              <p>Streetlights flicker on. Sarah checks her phone — barely a minute has passed.</p>
            </div>
            <div>
              <div className="preview-issue">
                <span className="issue-title preview-issue-title">Bandage swaps arms</span>
                <span className="muted">Continuity · High · 92% confidence</span>
              </div>
              <div className="preview-issue">
                <span className="issue-title preview-issue-title">Day-to-night jump, no elapsed time</span>
                <span className="muted">Timeline · Medium · 81% confidence</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h2 className="cta-title">Upload a script. Read the whole room's notes before your next draft.</h2>
        <div className="cta-row">
          <button className="btn btn-primary" onClick={onLaunch}>
            <Icon icon="solar:document-text-bold" className="icon" width={18} />
            Launch the app
          </button>
        </div>
      </section>

      <footer className="site-footer">
        <span>Ross — script continuity & fact-check agent</span>
        <div className="footer-links">
          <a href="#problem">Why it matters</a>
          <a href="#pipeline">Pipeline</a>
        </div>
      </footer>
    </div>
  );
}
