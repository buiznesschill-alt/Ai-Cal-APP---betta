"use client";
import { useI18n } from "@/lib/i18n";
import { useSectionDisplay, DisplayMode } from "@/lib/display";

export function LayoutToggle({ section }: { section: string }) {
  const { locale } = useI18n();
  const [display, setDisplay] = useSectionDisplay(section);
  const items: { id: DisplayMode; label: string }[] = [
    { id: "split", label: locale === "sk" ? "Panely vedľa seba" : "Side by side" },
    { id: "stacked", label: locale === "sk" ? "Panely pod sebou" : "Stacked" },
  ];

  const Icon = ({ id }: { id: DisplayMode }) =>
    id === "split" ? (
      <span className="flex gap-[3px]">
        <span className="w-[7px] h-[12px] rounded-[2px] bg-current" />
        <span className="w-[7px] h-[12px] rounded-[2px] bg-current" />
      </span>
    ) : (
      <span className="flex flex-col gap-[3px] items-center justify-center">
        <span className="w-[17px] h-[6px] rounded-[2px] bg-current" />
        <span className="w-[17px] h-[6px] rounded-[2px] bg-current" />
      </span>
    );

  return (
    <div className="flex items-center gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-full p-1">
      {items.map((it) => {
        const active = display === it.id;
        return (
          <button
            key={it.id}
            onClick={() => setDisplay(it.id)}
            aria-label={it.label}
            title={it.label}
            className={`h-7 w-9 rounded-full flex items-center justify-center transition-all ${
              active
                ? "bg-white dark:bg-zinc-950 shadow-sm text-fitcal-mintDark dark:text-emerald-400 scale-100"
                : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
          >
            <Icon id={it.id} />
          </button>
        );
      })}
    </div>
  );
}
