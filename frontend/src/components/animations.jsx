'use client';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  direction = 'up',
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const dirs = { up: [60, 0], down: [-60, 0], left: [0, -60], right: [0, 60] };
  const [y, x] =
    direction === 'left' || direction === 'right'
      ? [0, dirs[direction][1]]
      : [dirs[direction][0], 0];

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y, x, filter: 'blur(8px)' }}
      animate={isInView ? { opacity: 1, y: 0, x: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.9, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}

export function TextReveal({ text, className = '', delay = 0 }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const words = text.split(' ');

  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.3em]"
          initial={{ opacity: 0, y: 30, filter: 'blur(6px)' }}
          animate={isInView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{
            duration: 0.6,
            delay: delay + i * 0.06,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

export function TypewriterEffect({ phrases, className = '' }) {
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [currentText, setCurrentText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout;
    const fullText = phrases[currentPhraseIndex];

    if (!isDeleting && currentText === fullText) {
      timeout = setTimeout(() => setIsDeleting(true), 2500);
    } else if (isDeleting && currentText === '') {
      setIsDeleting(false);
      setCurrentPhraseIndex((prev) => (prev + 1) % phrases.length);
    } else {
      const nextText = isDeleting
        ? fullText.substring(0, currentText.length - 1)
        : fullText.substring(0, currentText.length + 1);
        
      const typingSpeed = isDeleting ? 20 : 40;
      
      timeout = setTimeout(() => {
        setCurrentText(nextText);
      }, typingSpeed + (Math.random() * 20));
    }

    return () => clearTimeout(timeout);
  }, [currentText, isDeleting, currentPhraseIndex, phrases]);

  return (
    <span className={className}>
      {currentText}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
        className="inline-block w-[0.05em] h-[0.9em] bg-slate-900 dark:bg-stone-100 align-middle ml-[2px] -mt-[4px]"
      />
    </span>
  );
}

export function ParallaxImage({ src, alt, className = '' }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{ y }}
        className="w-full h-[120%] object-cover"
      />
    </div>
  );
}

export function Counter({ value, label }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="flex flex-col items-center">
      <motion.span
        className="font-display-xl text-[48px] md:text-[64px] leading-none text-slate-900 dark:text-stone-100"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.8, type: 'spring', bounce: 0.3 }}
      >
        {value}
      </motion.span>
      <span className="font-label-caps text-label-caps text-slate-500 dark:text-stone-400 mt-2">
        {label}
      </span>
    </div>
  );
}

export function HorizontalScroll({ children, header }) {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  const [overflow, setOverflow] = useState(0);
  const [windowHeight, setWindowHeight] = useState(600);

  useEffect(() => {
    if (!trackRef.current) return;

    const updateDimensions = () => {
      const trackWidth = trackRef.current.scrollWidth;
      const containerWidth = trackRef.current.parentElement.offsetWidth;
      setOverflow(Math.max(0, trackWidth - containerWidth));
      setWindowHeight(window.innerHeight * 0.8);
    };

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    resizeObserver.observe(trackRef.current);
    if (trackRef.current.parentElement) {
      resizeObserver.observe(trackRef.current.parentElement);
    }
    window.addEventListener('resize', updateDimensions);

    updateDimensions();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [children]);

  // Ensure we use enough scroll height for the horizontal track
  // Use state variable to prevent SSR hydration mismatch mismatch
  const sectionHeight = overflow + windowHeight;

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    // Start exactly when the section hits the top of the viewport
    offset: ['start start', 'end end'],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -overflow]);

  return (
    <section
      ref={sectionRef}
      style={{ height: `${sectionHeight}px` }}
      className="relative"
    >
      <div className="sticky top-0 h-screen flex flex-col justify-center overflow-hidden">
        {/* Header and cards grouped tightly together */}
        {header && (
          <div className="w-full px-4 md:px-0 mb-8 z-20 relative">{header}</div>
        )}
        <div
          className="w-full overflow-hidden"
          style={{
            maskImage:
              'linear-gradient(to right, transparent, black 3%, black 97%, transparent)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent, black 3%, black 97%, transparent)',
          }}
        >
          <motion.div
            ref={trackRef}
            style={{ x }}
            className="flex w-max gap-6 pl-[5vw] md:pl-[10vw] will-change-transform items-center py-4 relative z-[60]"
          >
            {children}
            <div className="w-[5vw] md:w-[10vw] shrink-0" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
