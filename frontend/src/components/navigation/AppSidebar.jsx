import { Link } from "react-router-dom";
import { responsiveStyles } from "../responsiveStyles";
import RoutefyBrandMark from "../../assets/RoutefyBrandMark";
import AppTabs from "./AppTabs";

// Desktop-only left sidebar: brand (top) + vertical primary nav. Hidden below md,
// where the top header + tab strip take over.
export default function AppSidebar() {
  return (
    <aside className={responsiveStyles.sidebar}>
      <Link to="/home" aria-label="Routefy home" className={responsiveStyles.sidebarBrand}>
        <span className={responsiveStyles.sidebarBrandTile} aria-hidden="true">
          <RoutefyBrandMark className="h-7 w-7 text-blue-600 dark:text-blue-400" />
        </span>
        <span className={responsiveStyles.sidebarBrandWordmark}>Routefy</span>
      </Link>
      <AppTabs variant="sidebar" />
    </aside>
  );
}
