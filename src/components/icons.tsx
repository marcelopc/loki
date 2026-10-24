// Centralized UI icons (Material Design Icons).
// Wraps @mdi/react's <Icon> with a default size/class so buttons read cleanly.

import { Icon } from "@mdi/react";
import {
  mdiCheck,
  mdiClose,
  mdiContentSave,
  mdiContentSaveMove,
  mdiFolderOpenOutline,
  mdiGit,
  mdiGithub,
  mdiLaptop,
  mdiPlus,
  mdiRefresh,
  mdiSourceBranch,
  mdiTrayArrowDown,
  mdiTrayArrowUp,
} from "@mdi/js";

// NOTE: pass `size` as a string with a unit (e.g. "15px"). @mdi/react treats a
// numeric `size` as `1.5 * n` rems (size={16} ⇒ 24rem ≈ 384px) — a string
// bypasses that and lands on the exact pixel size.
type IconProps = {
  size?: string;
  className?: string;
};

export const FolderIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiFolderOpenOutline} size={size} className={className} />
);
export const RefreshIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiRefresh} size={size} className={className} />
);
export const PullIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiTrayArrowDown} size={size} className={className} />
);
export const PushIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiTrayArrowUp} size={size} className={className} />
);
export const StashIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiContentSave} size={size} className={className} />
);
export const PopIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiContentSaveMove} size={size} className={className} />
);
export const CheckIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiCheck} size={size} className={className} />
);
export const PlusIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiPlus} size={size} className={className} />
);
export const CloseIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiClose} size={size} className={className} />
);
export const BranchIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiSourceBranch} size={size} className={className} />
);
export const GithubIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiGit} size={size} className={className} />
);
// Local branch → laptop; remote branch → forge glyph. Kept forge-agnostic
// (mdiGithub is a generic octocat; gitlab exists under mdiGitlab if needed).
export const LaptopIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiLaptop} size={size} className={className} />
);
export const RemoteIcon = ({ size = "15px", className }: IconProps) => (
  <Icon path={mdiGithub} size={size} className={className} />
);