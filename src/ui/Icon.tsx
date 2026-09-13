import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/csr/ArrowsOutSimple";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { ImageIcon } from "@phosphor-icons/react/dist/csr/Image";
import { MinusIcon } from "@phosphor-icons/react/dist/csr/Minus";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { PuzzlePieceIcon } from "@phosphor-icons/react/dist/csr/PuzzlePiece";
import { ShuffleIcon } from "@phosphor-icons/react/dist/csr/Shuffle";
import { SparkleIcon } from "@phosphor-icons/react/dist/csr/Sparkle";
import { TrophyIcon } from "@phosphor-icons/react/dist/csr/Trophy";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { SquaresFourIcon } from "@phosphor-icons/react/dist/csr/SquaresFour";
const icons = {
  back: ArrowLeftIcon,
  arrow: ArrowRightIcon,
  fullscreen: ArrowsOutSimpleIcon,
  rotate: ArrowClockwiseIcon,
  next: CaretRightIcon,
  check: CheckCircleIcon,
  settings: GearSixIcon,
  image: ImageIcon,
  minus: MinusIcon,
  play: PlayIcon,
  plus: PlusIcon,
  puzzle: PuzzlePieceIcon,
  scatter: ShuffleIcon,
  sparkle: SparkleIcon,
  trophy: TrophyIcon,
  close: XIcon,
  collection: SquaresFourIcon,
} satisfies Record<string, PhosphorIcon>;
export function Icon({
  name,
  size = 24,
}: {
  name: keyof typeof icons;
  size?: number;
}) {
  const Component = icons[name];
  return (
    <Component
      size={size}
      weight="duotone"
      aria-hidden="true"
      className="game-icon"
    />
  );
}
