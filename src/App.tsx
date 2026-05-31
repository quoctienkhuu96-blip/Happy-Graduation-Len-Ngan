import { useState, useRef, useEffect, FormEvent } from "react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import {
  X,
  ArrowRight,
  Check,
  Menu,
  Sparkles,
  ArrowUp,
  ChevronDown,
  Calendar,
  Clock,
  MapPin,
  Car,
  Phone
} from "lucide-react";

// Register GSAP ScrollToPlugin
gsap.registerPlugin(ScrollToPlugin);

const TOTAL_FRAMES = 300;
const ZOOM_FACTOR = 1.35; // Applied to background cover to crop borders
const ASPECT_RATIO_WIDTH = 1920;
const ASPECT_RATIO_HEIGHT = 1080;

const NAV_LINKS = ["Thư Mời", "Lời Mời", "Thông Tin Buổi Lễ", "Xác Nhận"];

// Paste your deployed Google Apps Script Web App URL here to submit form data to Google Sheets
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxJOPzxTFABzhgTBRUUY5QyRastVJeJ7E2UD6vvNtS4RfUwBSchRoJzi_t8-flbeSVicg/exec";

export default function App() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState("Thư Mời");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // RSVP Form States
  const [guestName, setGuestName] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Preloading & Canvas States
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [scrollFraction, setScrollFraction] = useState(0);
  const [activeSection, setActiveSection] = useState(0);

  // Dual Canvas Refs for GPU-accelerated blur backdrop and sharp fit
  const canvasBlurRef = useRef<HTMLCanvasElement>(null);
  const canvasCleanRef = useRef<HTMLCanvasElement>(null);

  const imagesRef = useRef<HTMLImageElement[]>([]);
  const currentFrameIndexRef = useRef(0);
  const tickingRef = useRef(false);

  // Preload all 300 frames on mount
  useEffect(() => {
    let loadedCount = 0;
    const preloadedImages: HTMLImageElement[] = [];
    imagesRef.current = preloadedImages; // Make images reference available immediately

    // Detect if we should use responsive mobile frames (Robust user-agent + viewport width check)
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
    const folder = isMobileDevice ? "frames-mobile" : "frames";
    console.log(`Preloading cinematic sequence: using ${folder} folder.`);

    // Safety fallback to prevent hanging forever
    const loadingTimeout = setTimeout(() => {
      if (loadedCount < TOTAL_FRAMES) {
        console.warn("Loading timeout reached. Forcing load completion.");
        setIsLoaded(true);
        // Initial frame draw
        setTimeout(handleResize, 100);
      }
    }, 15000); // 15 seconds max loading wait for mobile data networks

    for (let i = 1; i <= TOTAL_FRAMES; i++) {
      const img = new Image();
      const frameStr = String(i).padStart(3, "0");
      img.src = `/${folder}/ezgif-frame-${frameStr}.jpg`;

      img.onload = () => {
        loadedCount++;
        const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);
        setLoadingProgress(percent);

        if (loadedCount === TOTAL_FRAMES) {
          clearTimeout(loadingTimeout);
          setIsLoaded(true);
          // Initial frame draw
          setTimeout(handleResize, 100);
        }
      };

      img.onerror = () => {
        // Safe progression even if a frame fails to load
        loadedCount++;
        const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);
        setLoadingProgress(percent);

        if (loadedCount === TOTAL_FRAMES) {
          clearTimeout(loadingTimeout);
          setIsLoaded(true);
          setTimeout(handleResize, 100);
        }
      };

      preloadedImages.push(img);
    }

    return () => clearTimeout(loadingTimeout);
  }, []);

  // Dual-Canvas Draw: Renders Cover to Blur canvas and Contain to Clean canvas
  const drawFrames = (activeImg: HTMLImageElement) => {
    const canvasBlur = canvasBlurRef.current;
    const canvasClean = canvasCleanRef.current;
    if (!activeImg) return;

    // Image source aspect ratio
    const imgWidth = activeImg.naturalWidth || ASPECT_RATIO_WIDTH;
    const imgHeight = activeImg.naturalHeight || ASPECT_RATIO_HEIGHT;
    const imgRatio = imgWidth / imgHeight;

    // 1. Draw BACKGROUND BLUR CANVAS using COVER logic (logical resolution is fine since it's blurred)
    if (canvasBlur) {
      const ctxBlur = canvasBlur.getContext("2d");
      if (ctxBlur) {
        ctxBlur.clearRect(0, 0, canvasBlur.width, canvasBlur.height);

        const canvasWidth = canvasBlur.width;
        const canvasHeight = canvasBlur.height;
        const canvasRatio = canvasWidth / canvasHeight;

        let renderWidth = canvasWidth;
        let renderHeight = canvasHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (canvasRatio > imgRatio) {
          renderHeight = canvasWidth / imgRatio;
          offsetY = (canvasHeight - renderHeight) / 2;
        } else {
          renderWidth = canvasHeight * imgRatio;
          offsetX = (canvasWidth - renderWidth) / 2;
        }

        // Apply ZOOM_FACTOR to back blur to prevent thin edge leakage
        const zoomedWidth = renderWidth * ZOOM_FACTOR;
        const zoomedHeight = renderHeight * ZOOM_FACTOR;
        const zoomedOffsetX = offsetX - (zoomedWidth - renderWidth) / 2;
        const zoomedOffsetY = offsetY - (zoomedHeight - renderHeight) / 2;

        ctxBlur.drawImage(activeImg, zoomedOffsetX, zoomedOffsetY, zoomedWidth, zoomedHeight);
      }
    }

    // 2. Draw FOREGROUND CLEAN CANVAS using CONTAIN logic on desktop, COVER logic on mobile for full screen
    if (canvasClean) {
      const ctxClean = canvasClean.getContext("2d");
      if (ctxClean) {
        ctxClean.clearRect(0, 0, canvasClean.width, canvasClean.height);

        // Enable ultra-sharp, high-quality image smoothing
        ctxClean.imageSmoothingEnabled = true;
        ctxClean.imageSmoothingQuality = "high";

        const canvasWidth = canvasClean.width;
        const canvasHeight = canvasClean.height;
        const canvasRatio = canvasWidth / canvasHeight;

        let renderWidth = canvasWidth;
        let renderHeight = canvasHeight;
        let offsetX = 0;
        let offsetY = 0;

        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;

        if (isMobileDevice) {
          // COVER logic on mobile for full screen 9:16 fill without any margins!
          if (canvasRatio > imgRatio) {
            // Viewport is wider than image aspect ratio
            renderHeight = canvasWidth / imgRatio;
            offsetY = (canvasHeight - renderHeight) / 2;
          } else {
            // Viewport is taller than image aspect ratio
            renderWidth = canvasHeight * imgRatio;
            offsetX = (canvasWidth - renderWidth) / 2;
          }
        } else {
          // CONTAIN logic on desktop to display the sharp centered frame
          if (canvasRatio > imgRatio) {
            // Viewport is wider than 16:9 image (letterbox borders on left & right)
            renderWidth = canvasHeight * imgRatio;
            offsetX = (canvasWidth - renderWidth) / 2;
          } else {
            // Viewport is taller than 16:9 image (letterbox borders on top & bottom)
            renderHeight = canvasWidth / imgRatio;
            offsetY = (canvasHeight - renderHeight) / 2;
          }
        }

        // Round coordinates to prevent subpixel interpolation blur (anti-aliasing)
        const finalX = Math.round(offsetX);
        const finalY = Math.round(offsetY);
        const finalWidth = Math.round(renderWidth);
        const finalHeight = Math.round(renderHeight);

        ctxClean.drawImage(activeImg, finalX, finalY, finalWidth, finalHeight);
      }
    }
  };

  // Handle window resizing dynamically
  const handleResize = () => {
    const canvasBlur = canvasBlurRef.current;
    const canvasClean = canvasCleanRef.current;
    if (!imagesRef.current.length) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;

    if (canvasBlur) {
      // Blur layer is locked to logical size to save GPU memory and draw overhead
      canvasBlur.width = width;
      canvasBlur.height = height;
    }
    if (canvasClean) {
      // Clean foreground layer is scaled to native physical resolution for crystal-clear results
      canvasClean.width = width * dpr;
      canvasClean.height = height * dpr;
    }

    const activeImg = imagesRef.current[currentFrameIndexRef.current];
    if (activeImg) {
      drawFrames(activeImg);
    }
  };

  // Scroll mapping logic (4 sections total now)
  const handleScroll = () => {
    if (!imagesRef.current.length) return;

    const scrollTop = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;

    if (maxScroll <= 0) return;

    const fraction = Math.min(Math.max(scrollTop / maxScroll, 0), 1);
    setScrollFraction(fraction);

    // Map scroll fraction to frame index (0-299)
    const frameIndex = Math.min(
      Math.floor(fraction * TOTAL_FRAMES),
      TOTAL_FRAMES - 1
    );

    currentFrameIndexRef.current = frameIndex;

    // Calculate active storytelling chapter (4 links: 0 to 3)
    if (fraction < 0.20) {
      setActiveSection(0);
      setActiveTab("Thư Mời");
    } else if (fraction >= 0.20 && fraction < 0.50) {
      setActiveSection(1);
      setActiveTab("Lời Mời");
    } else if (fraction >= 0.50 && fraction < 0.80) {
      setActiveSection(2);
      setActiveTab("Thông Tin Buổi Lễ");
    } else {
      setActiveSection(3);
      setActiveTab("Xác Nhận");
    }

    // Render using requestAnimationFrame for butter-smooth rendering
    if (!tickingRef.current) {
      window.requestAnimationFrame(() => {
        const activeImg = imagesRef.current[currentFrameIndexRef.current];
        if (activeImg) {
          drawFrames(activeImg);
        }
        tickingRef.current = false;
      });
      tickingRef.current = true;
    }
  };

  // Add scroll and resize listeners when loaded
  useEffect(() => {
    if (!isLoaded) return;

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize);

    // Initial resize to set dimensions
    handleResize();

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isLoaded]);

  // Smooth mouse parallax using GSAP
  useEffect(() => {
    if (!isLoaded) return;

    const handleMouseMove = (e: MouseEvent) => {
      const canvasBlur = canvasBlurRef.current;
      const canvasClean = canvasCleanRef.current;
      if (!canvasBlur || !canvasClean) return;

      const { clientX, clientY } = e;
      const xPercent = clientX / window.innerWidth - 0.5;
      const yPercent = clientY / window.innerHeight - 0.5;

      // Shift both canvas layers in perfect sync in the opposite direction
      gsap.to([canvasBlur, canvasClean], {
        x: -xPercent * 30,
        y: -yPercent * 30,
        duration: 0.8,
        ease: "power2.out",
        overwrite: "auto"
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isLoaded]);

  // Programmatic smooth navigation using GSAP ScrollToPlugin (4 sections)
  const navigateToSection = (sectionIndex: number) => {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    // Calculate fractional scroll values (0, 0.333, 0.666, 1.0)
    const targetScroll = maxScroll * (sectionIndex * 0.3333);

    setActiveTab(NAV_LINKS[sectionIndex]);

    gsap.to(window, {
      scrollTo: { y: targetScroll },
      duration: 1.6,
      ease: "power3.inOut"
    });
  };

  const handleModalSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!guestName || !userRole) return;
    setIsSubmitting(true);

    const roleLabel = userRole === "family" ? "Gia đình" : userRole === "classmate" ? "Bạn học" : "Bạn bè";

    try {
      if (GOOGLE_SCRIPT_URL) {
        const formData = new URLSearchParams();
        formData.append("name", guestName);
        formData.append("role", roleLabel);

        await fetch(GOOGLE_SCRIPT_URL, {
          method: "POST",
          mode: "no-cors", // Bypass CORS restrictions
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        });
      } else {
        // Fallback simulation for local testing if script URL is not set yet
        console.log("Mock RSVP Submission:", { name: guestName, role: roleLabel });
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setIsSubmitting(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error("Error submitting RSVP to Google Sheets:", error);
      // Proceed to success screen even on network fail so user experience doesn't break
      setIsSubmitting(false);
      setIsSubmitted(true);
    }
  };

  const resetModalState = () => {
    setGuestName("");
    setUserRole(null);
    setIsSubmitted(false);
  };

  return (
    <div className="relative min-h-screen bg-black text-white selection:bg-white/20 selection:text-white flex flex-col justify-between">

      {/* 1. CINEMATIC LOADING SCREEN */}
      {!isLoaded && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col justify-center items-center p-6 transition-opacity duration-700 select-none">
          <div className="flex flex-col items-center max-w-sm w-full text-center space-y-8 animate-fade-rise">

            {/* Minimalist Logo Branding */}
            <div className="flex flex-col items-center space-y-3">
              <img
                src="/vaa-logo.png"
                alt="Logo Học viện Hàng không Việt Nam"
                className="w-16 h-16 object-contain animate-pulse"
              />
              <div
                className="text-4xl tracking-tight text-white/90 font-semibold"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Lén Ngân<sup className="text-sm ml-0.5 relative -top-3">🎓</sup>
              </div>
            </div>

            {/* Glowing Glassmorphic Progress Container */}
            <div className="relative w-full h-[3px] bg-zinc-900/80 rounded-full overflow-hidden border border-zinc-800/40">
              {/* Progress fill */}
              <div
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-zinc-600 via-neutral-300 to-white rounded-full transition-all duration-300 shadow-[0_0_8px_rgba(255,255,255,0.4)]"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>

            {/* Status Details */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono tracking-[3px] text-white uppercase">
                Gửi lời mời trân trọng nhất...
              </span>
              <div className="text-lg font-mono font-medium text-white">
                {loadingProgress}%
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. FULLSCREEN SCROLLTELLING DUAL-CANVAS WRAPPER */}
      <div className="fixed inset-0 z-0 bg-[#0e0e12] pointer-events-none select-none overflow-hidden">
        {/* Background Blurred Layer (GPU Accelerated CSS Blur Filter) */}
        <canvas
          ref={canvasBlurRef}
          className="absolute inset-0 w-full h-full object-cover origin-center opacity-65"
          style={{
            filter: "blur(10px) brightness(1.8) saturate(0.7)", // Adjusted blur and brightness for optimal readability
            scale: 1.15 // Scaled up to avoid blurred borders clipping at the edges
          }}
        />
        {/* Frosted White Glass Overlay (Semi-transparent white frosted sheet) */}
        <div className="absolute inset-0 bg-white/[0.05] backdrop-blur-md pointer-events-none" />

        {/* Foreground Clean Layer (Contain Math for crisp margins fitting) */}
        <canvas
          ref={canvasCleanRef}
          className="absolute inset-0 w-full h-full object-cover md:object-contain origin-center opacity-95"
          style={{
            scale: 1.05,
            imageRendering: "-webkit-optimize-contrast", // Enhance sharpness and contrast on WebKit/Blink
            transform: "translate3d(0,0,0)", // Force separate GPU compositor texture layer
            backfaceVisibility: "hidden" // Prevent browser compression or downscaling blur
          }}
        />

        {/* 2 SIDES EFFECT - SAME AS TOP BAR (Reduced/subtle side frames) */}
        {/* Left Side Frame Overlay */}
        <div className="absolute top-0 bottom-0 left-0 w-4 sm:w-8 bg-gradient-to-r from-[#0e0e12]/45 to-transparent backdrop-blur-xs pointer-events-none z-10" />
        {/* Right Side Frame Overlay */}
        <div className="absolute top-0 bottom-0 right-0 w-4 sm:w-8 bg-gradient-to-l from-[#0e0e12]/45 to-transparent backdrop-blur-xs pointer-events-none z-10" />

        {/* Semi-Transparent White Vignette Overlay (No black shadows) */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] via-transparent to-white/[0.06] pointer-events-none" />
      </div>

      {/* 3. NAVIGATION BAR (FIXED HEADER) */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-black/90 via-black/40 to-transparent backdrop-blur-md select-none">
        <nav className="flex flex-row justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
          {/* Logo */}
          <button
            onClick={() => navigateToSection(0)}
            className="text-3xl tracking-tight text-white hover:opacity-90 transition-opacity cursor-pointer text-left font-semibold"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Lén Ngân<sup className="text-sm ml-0.5 font-sans relative -top-3">🎓</sup>
          </button>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex flex-row items-center space-x-12">
            {NAV_LINKS.map((link, idx) => {
              const isActive = activeTab === link;
              return (
                <button
                  key={link}
                  onClick={() => navigateToSection(idx)}
                  className={`text-sm tracking-wide transition-colors duration-300 relative py-1 cursor-pointer font-sans ${isActive ? "text-white font-medium" : "text-white/60 hover:text-white"
                    }`}
                >
                  {link}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Nav Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <button
              onClick={() => navigateToSection(3)}
              className="liquid-glass bg-white/10 backdrop-blur-md rounded-full px-6 py-2.5 text-sm text-white hover:scale-[1.03] transition-all duration-300 active:scale-[0.98] cursor-pointer font-sans"
            >
              Xác Nhận Tham Dự
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-white" />
            </button>
          </div>
        </nav>
      </header>

      {/* MOBILE NAV DRAWER (Glassmorphic) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md transition-opacity duration-300 select-none">
          <div className="w-full max-w-xs h-full bg-zinc-950/95 border-l border-zinc-800/80 p-8 flex flex-col justify-between relative">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-6 right-6 p-2 text-white hover:text-white hover:bg-zinc-900 rounded-full cursor-pointer transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mt-12 flex flex-col space-y-6">
              <div
                className="text-2xl tracking-tight text-white mb-8 font-semibold"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Lén Ngân<sup className="text-[10px] ml-0.5 relative -top-2">🎓</sup>
              </div>
              {NAV_LINKS.map((link, idx) => (
                <button
                  key={link}
                  onClick={() => {
                    navigateToSection(idx);
                    setMobileMenuOpen(false);
                  }}
                  className={`text-lg text-left tracking-wide py-1 transition-colors cursor-pointer font-sans ${activeTab === link ? "text-white font-medium" : "text-white/60 hover:text-white"
                    }`}
                >
                  {link}
                </button>
              ))}
            </div>

            <div className="flex flex-col space-y-4">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigateToSection(3);
                }}
                className="liquid-glass bg-white/15 backdrop-blur-md w-full rounded-full py-4 text-center text-sm font-medium text-white hover:scale-[1.02] transition-transform cursor-pointer font-sans"
              >
                Xác Nhận Tham Dự
              </button>
              <p className="text-[10px] text-white text-center tracking-tight font-sans">
                © 2026 Lén Ngân. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 4. SCROLLTELLING CHAPTERS OVERLAY (400vh CONTAINER) */}
      <div className="relative z-10 w-full flex flex-col">

        {/* CHAPTER 0: HERO / THƯ MỜI (0vh - 100vh) */}
        <section className="min-h-screen w-full flex flex-col justify-center items-center px-6 relative pt-20">
          <div className="max-w-4xl mx-auto text-center flex flex-col items-center liquid-glass p-8 sm:p-14 rounded-[36px] bg-zinc-950/75 backdrop-blur-2xl border border-white/10 shadow-2xl animate-fade-rise">

            {/* Cinematic Entrance Heading */}
            <h1
              className="text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-1.5px] font-normal text-white uppercase"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              HAPPY <br />
              <em className="not-italic text-white font-semibold">GRADUATION</em> <br />
            </h1>

            {/* Cinematic Subtext wrapped in a soft blur container for ultimate legibility */}
            <div className="text-white text-sm sm:text-base max-w-2xl mt-8 leading-relaxed font-sans px-6 py-5 rounded-2xl bg-black/35 backdrop-blur-sm border border-white/5 shadow-inner text-left sm:text-center space-y-4">
              <p>
                Cuối cùng ngày này cũng đã đến!
              </p>
              <p>
                Sau một hành trình dài với deadline, bài tập nhóm, những mùa thi căng thẳng và vô số lần tự nhủ &quot;mai em làm&quot;, mình cũng đã chính thức hoàn thành nhiệm vụ sinh viên.
              </p>
              <p>
                Một cột mốc đáng nhớ như thế này sẽ vui hơn rất nhiều khi có sự hiện diện của những người mình yêu quý.
              </p>
              <div className="pt-2.5 border-t border-white/10 flex justify-center items-center gap-2 text-xs sm:text-sm font-mono tracking-widest text-neutral-300 uppercase">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
                <span>Graduation Ceremony 2026</span>
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
            </div>

            {/* Scroll indicator CTA */}
            <div className="mt-12 flex flex-col items-center gap-2 animate-bounce">
              <span className="text-[10px] tracking-[4px] font-mono text-white uppercase">
                Cuộn để Xem Chi Tiết
              </span>
              <ChevronDown className="w-5 h-5 text-white" />
            </div>

          </div>
        </section>

        {/* CHAPTER 1: LỜI MỜI / THƯ MỜI THAM DỰ (100vh - 200vh) */}
        <section className="min-h-screen w-full flex items-center justify-start px-6 md:px-24 max-w-7xl mx-auto py-24">
          <div
            className={`liquid-glass p-8 sm:p-10 rounded-[32px] max-w-xl text-left bg-zinc-950/75 backdrop-blur-2xl transition-all duration-700 transform ${activeSection === 1 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95 pointer-events-none"
              }`}
          >
            <div className="flex items-center gap-2 text-xs text-white font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>01 // THƯ MỜI THAM DỰ</span>
            </div>

            <h2
              className="text-4xl tracking-tight text-white mb-4"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Thư Mời Tham Dự
            </h2>

            <div className="space-y-4 text-white text-sm leading-relaxed font-sans">
              <div className="p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5 shadow-inner">
                <p className="font-semibold">Mình xin gửi đến bạn một chiếc thiệp mời nho nhỏ...</p>
                <p className="mt-2 text-neutral-300">📢 Mời bạn đến chung vui cùng mình trong Lễ Tốt nghiệp nhé!</p>
              </div>

              <div className="p-5 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5 shadow-inner space-y-3">
                <div className="text-xs uppercase font-mono tracking-wider text-neutral-400">Đến để:</div>
                <ul className="space-y-2.5">
                  <li className="flex items-center gap-3 text-neutral-200">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    <span>Chia sẻ niềm vui cùng tân cử nhân</span>
                  </li>
                  <li className="flex items-center gap-3 text-neutral-200">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    <span>Chụp thật nhiều ảnh đẹp</span>
                  </li>
                  <li className="flex items-center gap-3 text-neutral-200">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    <span>Và cùng lưu giữ thêm một kỷ niệm thật đáng nhớ</span>
                  </li>
                </ul>
              </div>

              <p className="text-neutral-200 italic text-center p-3 rounded-lg bg-white/[0.02] text-xs">
                &ldquo;Sự hiện diện của bạn chính là điều khiến ngày hôm đó trở nên đặc biệt hơn rất nhiều.&rdquo;
              </p>

              <div className="text-center font-semibold text-white tracking-wide border-t border-white/5 pt-3">
                Hẹn gặp bạn tại buổi lễ nha!
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 2: THÔNG TIN BUỔI LỄ (200vh - 300vh) */}
        <section className="min-h-screen w-full flex items-center justify-end px-6 md:px-24 max-w-7xl mx-auto py-24">
          <div
            className={`liquid-glass p-8 sm:p-10 rounded-[32px] max-w-xl text-left bg-zinc-950/75 backdrop-blur-2xl transition-all duration-700 transform ${activeSection === 2 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95 pointer-events-none"
              }`}
          >
            <div className="flex items-center gap-2 text-xs text-white font-mono mb-3">
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              <span>02 // CHI TIẾT TỔ CHỨC</span>
            </div>

            <h2
              className="text-4xl tracking-tight text-white mb-6"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Thông Tin Buổi Lễ
            </h2>

            <div className="space-y-4 font-sans text-white text-sm">
              {/* Date & Time info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5">
                  <Calendar className="w-5 h-5 text-white opacity-95 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">Ngày tổ chức:</div>
                    <div className="font-semibold text-neutral-200"> Chủ Nhật - 07.06.2026</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5">
                  <Clock className="w-5 h-5 text-white opacity-95 flex-shrink-0" />
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">Thời gian:</div>
                    <div className="font-semibold text-neutral-200">17:00 – 18:00</div>
                  </div>
                </div>
              </div>

              {/* Event Location */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5">
                <MapPin className="w-5 h-5 text-white opacity-95 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">Địa điểm:</div>
                  <div className="font-semibold text-neutral-200 text-sm">Học viện Hàng không Việt Nam – Cơ sở 2</div>
                  <div className="text-xs text-neutral-300 mt-1 leading-relaxed">
                    18A/1 Cộng Hòa, Phường Tân Sơn Nhất, TP. Hồ Chí Minh.
                  </div>
                </div>
              </div>

              {/* Parking Lot */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5">
                <Car className="w-5 h-5 text-white opacity-95 mt-1 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">Nơi gửi xe:</div>
                  <div className="font-semibold text-neutral-200 text-sm">Lotte Cộng Hòa</div>
                  <div className="text-xs text-neutral-300 mt-0.5 leading-relaxed">
                    (Sau đó đi bộ vào khu vực tổ chức)
                  </div>
                </div>
              </div>

              {/* Phone Contacts */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-black/35 backdrop-blur-sm border border-white/5">
                <Phone className="w-5 h-5 text-white opacity-95 flex-shrink-0" />
                <div>
                  <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono block">Liên hệ hỗ trợ:</span>
                  <span className="font-semibold text-neutral-200">0976.484.484 - Lén Ngân</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CHAPTER 3: XÁC NHẬN RSVP (300vh - 400vh) */}
        <section className="min-h-screen w-full flex items-center justify-center px-6 py-24 relative">
          <div
            className={`liquid-glass w-full max-w-lg rounded-3xl p-8 sm:p-10 text-left bg-zinc-950/75 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl transition-all duration-700 transform ${activeSection === 3 ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95 pointer-events-none"
              }`}
          >
            {!isSubmitted ? (
              <form onSubmit={handleModalSubmit} className="space-y-6">
                <div>
                  <div className="flex items-center gap-2 text-xs text-white font-mono mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                    <span>Graduation RSVP // LÉN NGÂN</span>
                  </div>
                  <h3
                    className="text-4xl tracking-tight text-white font-medium"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    Xác Nhận Tham Dự
                  </h3>
                  <p className="text-neutral-300 text-sm mt-3 leading-relaxed font-sans p-4 rounded-xl bg-black/35 border border-white/5">
                    Nếu sắp xếp được thời gian, cho mình xin một chiếc xác nhận tham dự nha 🥰
                  </p>
                </div>

                {/* Identity Selection */}
                <div className="space-y-2">
                  <span className="text-xs text-white uppercase tracking-widest font-mono">
                    Mối quan hệ với Lén Ngân:
                  </span>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { id: "family", label: "Gia đình" },
                      { id: "classmate", label: "Bạn học" },
                      { id: "friend", label: "Bạn bè" }
                    ].map((role) => (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setUserRole(role.id)}
                        className={`text-xs p-3 rounded-xl border text-center transition-all cursor-pointer font-sans tracking-wide ${userRole === role.id
                          ? "bg-white text-black font-semibold border-white"
                          : "bg-transparent text-white border-zinc-900 hover:border-zinc-700 hover:text-white"
                          }`}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name input */}
                <div className="space-y-2">
                  <label htmlFor="guest-name" className="text-xs text-white uppercase tracking-widest font-mono">
                    Tên của quý khách:
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    required
                    placeholder="Nhập tên của bạn tại đây..."
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full bg-zinc-950/60 border border-zinc-800 text-white rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:ring-1 focus:ring-white focus:border-white placeholder:text-white/40 transition-all font-sans"
                  />
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !userRole || !guestName}
                  className={`w-full rounded-full py-4 text-sm font-medium transition-all flex items-center justify-center gap-2 cursor-pointer font-sans ${userRole && guestName
                    ? "bg-white text-black hover:bg-neutral-200 active:scale-[0.99]"
                    : "bg-zinc-900 text-zinc-600 cursor-not-allowed border border-transparent"
                    }`}
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Gửi Xác Nhận</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              // Success Screen representation - THANK YOU layout
              <div className="flex flex-col items-center justify-center py-6 text-center space-y-6 animate-fade-rise">
                <div className="w-20 h-20 rounded-2xl bg-white p-2.5 flex items-center justify-center border border-white/10 animate-pulse shadow-xl">
                  <img
                    src="/vaa-logo.png"
                    alt="Logo Học viện Hàng không Việt Nam"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="space-y-4 w-full">
                  <h4
                    className="text-4xl tracking-widest text-white font-semibold uppercase"
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                  >
                    THANK YOU ✈
                  </h4>
                  <div className="text-white text-sm max-w-sm mx-auto leading-relaxed font-sans space-y-3">
                    <p>
                      Cảm ơn <span className="text-white font-semibold font-mono">{guestName}</span> đã là một phần trong hành trình của mình.
                    </p>
                    <div className="p-4 rounded-xl bg-black/45 border border-white/5 text-xs text-neutral-300">
                      Hẹn gặp bạn vào ngày mình chính thức chuyển hệ từ:<br />
                      <span className="font-semibold text-white block mt-2 text-sm">Sinh viên ➜ 🎓 Cử nhân</span>
                    </div>
                    <p className="font-mono text-[10px] tracking-[4px] text-neutral-400 mt-4 uppercase">See you there! ✨</p>
                  </div>
                </div>
                <button
                  onClick={resetModalState}
                  className="liquid-glass bg-white/5 hover:bg-white/10 px-8 py-3 rounded-full text-xs font-mono tracking-widest uppercase hover:text-white cursor-pointer transition-transform border border-white/5"
                >
                  Quay lại
                </button>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* 5. FLOATING FOOTER DETAILS & "SCROLL TO TOP" BUTTON */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 select-none pointer-events-none">
        <div className="max-w-7xl mx-auto px-8 py-8 flex flex-col md:flex-row justify-between items-center gap-6 bg-transparent w-full">

          {/* Ambient branding (Hidden on small mobile to maximize card layout breathing room) */}
          <div className="hidden sm:flex items-center space-x-3 text-[10px] sm:text-xs tracking-widest text-white font-mono bg-zinc-950/85 border border-white/10 p-2.5 px-4 rounded-full backdrop-blur-md shadow-lg select-none">
            <span>LÉN NGÂN // GRADUATION</span>
            <span className="w-1.5 h-1.5 rounded-full bg-white inline-block animate-pulse" />
            <span>Chủ nhật 07.06.2026</span>
          </div>


          {/* Floating Action Controls */}
          <div className="pointer-events-auto flex items-center space-x-3">
            {scrollFraction > 0.08 && (
              <button
                onClick={() => navigateToSection(0)}
                className="liquid-glass bg-zinc-950/80 backdrop-blur-md p-3.5 rounded-full text-white hover:text-white transition-colors cursor-pointer border border-white/5 shadow-md"
                title="Scroll back to Top"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>
      </footer>

    </div>
  );
}
