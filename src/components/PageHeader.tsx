"use client";
import { DesktopNav } from "@/components/BottomNav";
import { LayoutToggle } from "@/components/LayoutToggle";

export function PageHeader({ toggleSection, hideSettings = false }: { toggleSection?: string; hideSettings?: boolean }) {
  return (
    <div className="relative flex justify-center pt-1">
      <DesktopNav showAlways hideSettings={hideSettings} />
      {toggleSection && (
        <div className="absolute right-0 top-0 h-full items-center hidden md:flex">
          <LayoutToggle section={toggleSection} />
        </div>
      )}
    </div>
  );
}
