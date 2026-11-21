import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { useEffect, useState } from "react";
import { db } from "#/db";
import { dishes, menus } from "#/db/schema";
import { app } from "#/generated/app";
import type { CustomSectionProps } from "#/generated/custom";
import { pageAccess } from "#/generated/pages";
import { dayText, moneyText } from "#/kit/format";
import { Section } from "#/kit/Landing";
import { now } from "#/kit/now";
import { guardPage } from "#/kit/page-guard";
import { currentViewer } from "#/lib/viewer.server";
import { activeMenu, localServiceDay, serviceLabel, services } from "./service";

const loadMenu = createServerFn().handler(async () => {
  guardPage(pageAccess.menu, await currentViewer(), "/menu");
  const { date } = localServiceDay(now(), app.timeZone);
  // Read the published projection together, without granting generic access to future or draft records.
  return db.transaction((tx) => {
    const published = tx.select().from(menus).where(eq(menus.status, "published")).all();
    const menu = activeMenu(published, date);
    if (!menu) return null;

    const rows = tx
      .select({
        id: dishes.id,
        name: dishes.name,
        service: dishes.service,
        description: dishes.description,
        dietaryTags: dishes.dietaryTags,
        price: dishes.price,
        smallPrice: dishes.smallPrice,
      })
      .from(dishes)
      .where(eq(dishes.menuId, menu.id))
      .orderBy(dishes.id)
      .all();
    return {
      name: menu.name,
      period: menu.kind === "seasonal" ? { from: menu.startsOn, to: menu.endsOn } : null,
      dishes: rows.map(({ dietaryTags, ...dish }) => ({
        ...dish,
        dietaryTags:
          dietaryTags
            ?.split(",")
            .map((tag) => tag.trim())
            .filter(Boolean) ?? [],
      })),
    };
  });
});

export function ServiceMenu({ name, texts, title, text }: CustomSectionProps) {
  const [menu, setMenu] = useState<Awaited<ReturnType<typeof loadMenu>>>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    loadMenu().then(setMenu, () => setFailed(true));
  }, []);

  const heading = menu?.name ?? title ?? "On the menu";
  return (
    <Section id={name} texts={texts} title={heading} text={text}>
      <div aria-live="polite">
        {menu ? (
          <>
            {menu.period?.from && menu.period.to && (
              <p className="mb-6 text-muted-foreground">
                <time dateTime={menu.period.from}>{dayText(menu.period.from)}</time>
                {" – "}
                <time dateTime={menu.period.to}>{dayText(menu.period.to)}</time>
              </p>
            )}
            <div className="grid gap-x-14 gap-y-9 lg:grid-cols-2">
              {services.map((service) => {
                const items = menu.dishes.filter((dish) => dish.service === service);
                return (
                  <section key={service} aria-label={serviceLabel[service]}>
                    <h3 className="font-heading text-2xl font-semibold">{serviceLabel[service]}</h3>
                    {items.length ? (
                      <ul className="mt-3 divide-y divide-border border-y border-border">
                        {items.map((dish) => (
                          <li key={dish.id} className="py-4">
                            <div className="flex items-baseline justify-between gap-3">
                              <h4 className="min-w-0 wrap-break-word font-semibold">{dish.name}</h4>
                              <span className="shrink-0 font-medium tabular-nums">
                                {moneyText(dish.price, app.currency)}
                              </span>
                            </div>
                            {dish.description && (
                              <p className="mt-1 text-sm text-muted-foreground">
                                {dish.description}
                              </p>
                            )}
                            {dish.smallPrice !== null && (
                              <p className="mt-1 text-sm">
                                Small portion {moneyText(dish.smallPrice, app.currency)}
                              </p>
                            )}
                            {dish.dietaryTags.length > 0 && (
                              <p className="mt-2 text-sm font-medium text-primary-text">
                                {dish.dietaryTags.join(" · ")}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-muted-foreground">
                        No dishes listed for this service.
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            {failed
              ? "The menu could not load. Please try again."
              : menu === null
                ? "No menu is published for today."
                : "Loading menu…"}
          </p>
        )}
      </div>
    </Section>
  );
}
