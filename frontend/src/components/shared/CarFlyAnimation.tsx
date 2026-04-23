import { useState } from "react";

type Car = { key: number; top: number; flip: boolean; duration: number };

type CarFlyAnimationProps = {
  children: (trigger: (e: React.MouseEvent) => void) => React.ReactNode;
};

export default function CarFlyAnimation({ children }: CarFlyAnimationProps) {
  const [cars, setCars] = useState<Car[]>([]);

  const trigger = (e: React.MouseEvent) => {
    if (window.innerWidth < 1280) return;
    e.preventDefault();
    const top = 10 + Math.random() * 75;
    const flip = Math.random() < 0.5;
    const duration = 1800 + Math.random() * 800;
    const key = Date.now() + Math.random();
    setCars((prev) => [...prev, { key, top, flip, duration }]);
    setTimeout(() => setCars((prev) => prev.filter((c) => c.key !== key)), duration + 100);
  };

  return (
    <>
      {children(trigger)}
      {cars.map((car) => (
        <div
          key={car.key}
          aria-hidden="true"
          className="car-fly-animation pointer-events-none fixed left-0 z-50 hidden text-3xl xl:block"
          style={{
            top: `${car.top}vh`,
            animationDuration: `${car.duration}ms`,
            transform: car.flip ? "scaleX(-1)" : undefined,
          }}
        >
          🚗
        </div>
      ))}
    </>
  );
}
