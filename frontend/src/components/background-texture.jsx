'use client';
import { motion } from 'framer-motion';

export function BackgroundTexture() {
  return (
    <>
      <div className="fixed inset-0 z-[0] overflow-hidden pointer-events-none bg-surface dark:bg-stone-950">
        <motion.div 
          animate={{ 
            x: [0, 100, -50, 0], 
            y: [0, -100, 50, 0],
            scale: [1, 1.1, 0.9, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-primary/20 dark:bg-primary/10 blur-[120px]"
        />
        <motion.div 
          animate={{ 
            x: [0, -100, 50, 0], 
            y: [0, 100, -50, 0],
            scale: [1, 1.2, 0.8, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-accent/20 dark:bg-accent/10 blur-[150px]"
        />
        <motion.div 
          animate={{ 
            x: [0, 50, -100, 0], 
            y: [0, -50, 100, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
          className="absolute top-[20%] right-[20%] w-[40vw] h-[40vw] rounded-full bg-secondary/20 dark:bg-secondary/10 blur-[100px]"
        />
        <motion.div 
          animate={{ 
            x: [0, -150, 100, 0], 
            y: [0, 150, -100, 0],
            scale: [1, 1.2, 0.8, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-secondary/20 dark:bg-secondary/10 blur-[150px]"
        />
        <motion.div 
          animate={{ 
            x: [0, 50, -100, 0], 
            y: [0, 100, -50, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute top-[40%] left-[30%] w-[40vw] h-[40vw] rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-[100px]"
        />
      </div>

      <div className="fixed inset-0 z-[1] pointer-events-none bg-white/50 dark:bg-stone-900/40 backdrop-blur-[60px] dark:backdrop-blur-[40px]" />

      <div
        className="fixed inset-0 z-[2] pointer-events-none opacity-[0.12] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1504711434969-e33886168f5c?q=80&w=2000&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </>
  );
}
