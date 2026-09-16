import { type Page } from 'playwright';

import { type Control } from '#helpers/compare-docs/types.ts';

const controlSelector =
  'a[href],button,[role="button"],[role="link"],[role="tab"],summary,input[type="button"],input[type="submit"],[aria-haspopup],[aria-expanded]';

export const getInventory = (page: Page): Promise<Control[]> => {
  return page.locator(controlSelector).evaluateAll<Control[], undefined>((elements) => {
    for (const element of document.querySelectorAll('[data-docs-compare-control]')) {
      element.removeAttribute('data-docs-compare-control');
    }

    const counts = new Map<string, number>();
    const normalize = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

    const textOf = (node: Element): string => {
      let text = '';

      for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
          text += child.nodeValue ?? '';
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          text += ` ${textOf(child as Element)} `;
        }
      }

      return text;
    };

    const visible = (element: Element) => {
      if (element.closest('[hidden],[inert],[aria-hidden="true"]')) {
        return false;
      }

      const rect = element.getBoundingClientRect();

      if (rect.width < 1 || rect.height < 1 || rect.right <= 0 || rect.left >= innerWidth) {
        return false;
      }

      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);

        if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') {
          return false;
        }
      }

      if (rect.bottom > 0 && rect.top < innerHeight && !element.matches(':disabled')) {
        const left = Math.max(0, rect.left);
        const right = Math.min(innerWidth - 1, rect.right);
        const top = Math.max(0, rect.top);
        const bottom = Math.min(innerHeight - 1, rect.bottom);

        const exposed = [0.2, 0.5, 0.8].some((fraction) => {
          const hit = document.elementFromPoint(left + (right - left) * fraction, top + (bottom - top) * fraction);

          return hit === element || element.contains(hit);
        });

        if (!exposed) return false;
      }

      return true;
    };

    return elements.filter(visible).map((element, index) => {
      const labelledBy = (element.getAttribute('aria-labelledby') ?? '')
        .split(/\s+/)
        .map((id) => {
          const target = document.getElementById(id);

          return target ? textOf(target) : '';
        })
        .join(' ');

      const label = normalize(
        [
          element.getAttribute('aria-label'),
          labelledBy,
          element.getAttribute('title'),
          textOf(element),
          element.querySelector('img')?.alt,
          element.getAttribute('value'),
        ].find((candidate) => !!candidate)
      ).slice(0, 180);

      let href = element.getAttribute('href') ?? '';

      if (href) {
        try {
          const url = new URL(href, location.href);

          href = url.origin === location.origin ? url.pathname + url.search + url.hash : url.href;
        } catch {
          /* Preserve malformed destinations in the identity. */
        }
      }

      const roleAttribute = element.getAttribute('role');
      const role = roleAttribute === null || roleAttribute === '' ? (element.tagName === 'A' ? 'link' : 'button') : roleAttribute;
      const identity = JSON.stringify([role, label, href]);
      const occurrence = counts.get(identity) ?? 0;

      counts.set(identity, occurrence + 1);

      const key = `${identity}#${occurrence}`;

      element.setAttribute('data-docs-compare-control', String(index));

      const expanded = element.getAttribute('aria-expanded');
      const popup = element.getAttribute('aria-haspopup');
      const tab = role === 'tab';
      const selected = element.getAttribute('aria-selected');
      const summary = element.tagName === 'SUMMARY';
      const search = role === 'button' && /search/i.test(label) && !/^(close|dismiss|cancel)\b/i.test(label);
      const pressed = element.getAttribute('aria-pressed');
      const panel = !!element.getAttribute('aria-controls');
      const state = element.getAttribute('data-state');
      const disabled = element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
      const trigger = expanded !== null || (!!popup && popup !== 'false') || tab || summary || search || (panel && pressed !== null);
      const active = tab ? selected === 'true' : pressed !== null ? pressed === 'true' : false;

      return {
        key,
        index,
        label: label === '' ? '(unlabelled control)' : label,
        href,
        role,
        disabled,
        trigger: trigger && !active,
        signature: JSON.stringify([
          expanded,
          selected,
          pressed,
          state,
          summary ? ((element.parentElement as HTMLDetailsElement | null)?.open ?? null) : null,
        ]),
      };
    });
  });
};
