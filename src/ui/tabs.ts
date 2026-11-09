/** Props for the panel of a <Tabs> tab, so ids and aria wiring match (Phase 12). */
export function tabPanelProps(id: string, idPrefix = 'tab') {
  return {
    role: 'tabpanel' as const,
    id: `${idPrefix}-panel-${id}`,
    'aria-labelledby': `${idPrefix}-${id}`,
  };
}
