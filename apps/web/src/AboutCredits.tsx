import { Card, CardContent, CardHeader, CardTitle } from './ui';

export function AboutCredits() {
  return <section aria-label="About / Credits" className="mt-5">
    <h3>About / Credits</h3>
    <Card size="compact">
      <CardHeader><CardTitle>Plant collection</CardTitle></CardHeader>
      <CardContent>
        <p className="m-0 text-ui text-muted">Models from <a href="https://kenney.nl/assets/nature-kit" target="_blank" rel="noreferrer" className="text-accent underline">Kenney Nature Kit</a>, released under <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer" className="text-accent underline">CC0 1.0</a>.</p>
        <p className="mb-0 text-ui text-muted">Optimized and recolored in Blender for OpenLandcraft. Growth and wind animation added in the viewer. Attribution is optional; source and license records are included with the assets.</p>
      </CardContent>
    </Card>
    <Card size="compact" className="mt-3">
      <CardHeader><CardTitle>Bird collection</CardTitle></CardHeader>
      <CardContent><p className="m-0 text-ui text-muted"><a href="https://opengameart.org/content/bird" target="_blank" rel="noreferrer" className="text-accent underline">Bird by Fabio Gonzalez</a>, based on <a href="https://opengameart.org/content/bird-basemesh" target="_blank" rel="noreferrer" className="text-accent underline">noway’s bird basemesh</a>. Both CC0 1.0. Recolored with a new wing cycle in Blender; flight and gliding added in OpenLandcraft.</p></CardContent>
    </Card>
    <Card size="compact" className="mt-3">
      <CardHeader><CardTitle>Fish collection</CardTitle></CardHeader>
      <CardContent><p className="m-0 text-ui text-muted"><a href="https://opengameart.org/content/fish-1" target="_blank" rel="noreferrer" className="text-accent underline">Fish by joyfulsquirrel</a>, released under CC0 1.0. Reshaped in Blender with natural proportions, silver-green coloring, and a seven-joint swimming rig; water-aware routes added in OpenLandcraft.</p></CardContent>
    </Card>
    <Card size="compact" className="mt-3">
      <CardHeader><CardTitle>Animals and people</CardTitle></CardHeader>
      <CardContent><p className="m-0 text-ui text-muted">Horse from the <a href="https://opengameart.org/content/lowpoly-animated-farm-animal-pack" target="_blank" rel="noreferrer" className="text-accent underline">Farm Animal Pack</a> and casual people from the <a href="https://opengameart.org/content/animated-characters-pack" target="_blank" rel="noreferrer" className="text-accent underline">Animated Characters Pack</a> by Quaternius, released under CC0 1.0. Prepared in Blender with matte materials and baked walk and idle cycles; terrain movement and spacing added in OpenLandcraft.</p></CardContent>
    </Card>
  </section>;
}
