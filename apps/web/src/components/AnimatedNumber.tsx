import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  /** spring 강도 (높을수록 빠름). 기본 50 (느린 카운트업) */
  stiffness?: number;
  /** spring 감쇠. 기본 22 */
  damping?: number;
}

/**
 * 숫자가 부드럽게 카운트업/다운되는 컴포넌트.
 * 점수, 더미 카운트, 카운터 등에 사용.
 */
export function AnimatedNumber({
  value,
  className,
  stiffness = 50,
  damping = 22,
}: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness, damping });
  const display = useTransform(spring, (n) => Math.round(n).toString());

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  return <motion.span className={className}>{display}</motion.span>;
}
