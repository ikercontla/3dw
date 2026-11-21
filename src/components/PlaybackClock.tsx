import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject,
  type ReactNode,
} from "react";
import { useFrame } from "@react-three/fiber";

export interface PlaybackClockContextValue {
  clockRef: MutableRefObject<number>;
  speedRef: MutableRefObject<number>;
  pausedRef: MutableRefObject<boolean>;
}

const PlaybackClockContext = createContext<PlaybackClockContextValue | null>(
  null
);

interface PlaybackClockProviderProps {
  speed: number;
  paused: boolean;
  children: ReactNode;
}

export function PlaybackClockProvider({
  speed,
  paused,
  children,
}: PlaybackClockProviderProps) {
  const clockRef = useRef(0);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useFrame((_, delta) => {
    if (pausedRef.current) return;
    const clamped = Math.min(delta, 0.05);
    clockRef.current += clamped * speedRef.current;
  });

  const value = useMemo<PlaybackClockContextValue>(
    () => ({ clockRef, speedRef, pausedRef }),
    []
  );

  return (
    <PlaybackClockContext.Provider value={value}>
      {children}
    </PlaybackClockContext.Provider>
  );
}

export function usePlaybackClock(): PlaybackClockContextValue {
  const ctx = useContext(PlaybackClockContext);
  const fallbackClock = useRef(0);
  const fallbackSpeed = useRef(1);
  const fallbackPaused = useRef(false);

  if (ctx) return ctx;
  return {
    clockRef: fallbackClock,
    speedRef: fallbackSpeed,
    pausedRef: fallbackPaused,
  };
}
