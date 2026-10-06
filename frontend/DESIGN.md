# Water Economics design direction

The memorable element is a contained, animated body of water on a miniature infrastructure landscape. Quiet white control surfaces frame the model, leaving it the largest element. Source connections and sector colors explain the water system before charts do.

Palette: warm off-white #F7F7F2, deep teal-charcoal #173B3A, primary teal #2FA89A, water highlight #73C9C3, and divider neutral #DDE5E1. Typography: locally installed Segoe UI for readable controls, with Georgia reserved for the expressive workspace title. Left-aligned controls and a centered physical model.

Layout: the simulation is a full-bleed water table. Municipality context floats above it, source and impact instruments sit in collapsible translucent trays, live values are pinned to the physical model, and scenario actions form a bottom command dock. Supporting views live behind the primary navigation instead of competing below the scene. On narrower screens, the scene remains first and trays stack in reading order. Maintain visible focus, 44px touch targets, semantic form labels, reduced motion and numerical alternatives to visualizations.

Review: the previous three-column layout still made the reservoir feel like a dashboard widget. The revised composition removes the separate page introduction and supporting-card row from simulation mode, gives the scene the viewport, and treats controls as instruments placed over a shared physical model. The provided frontend-design and ui-ux-pro-max guidance informs the implementation; the latter's referenced scripts and design database were not supplied, and Python is unavailable.
