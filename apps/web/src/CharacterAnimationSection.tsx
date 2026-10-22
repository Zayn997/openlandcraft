import type { GroundRoute, Instance } from '@openlandcraft/core';
import { InspectorSection } from './InspectorSection';
import { Field, FieldMessage, SelectInput, SelectOption } from './ui';

function motionDescription(route:GroundRoute | null | undefined) {
  if (!route) return 'Move onto dry, gently sloping ground away from buildings and other characters.';
  if (route.path) return 'Following this person’s walking route. People pass where there is room and wait or turn back when blocked.';
  if (route.reason === 'idle') return 'Idle animation at the placed position.';
  if (route.reason === 'fixed') return 'Use Follow terrain and a ground offset near zero to enable walking.';
  if (route.reason === 'no-path') return 'Draw a walking route below. This person idles until their own route is available.';
  if (route.reason === 'blocked') return 'No usable path nearby. Widen the path or clear its obstructions; this person idles until there is room.';
  return route.radius ? 'Walking around this area with space reserved for the whole route.' : 'Idling here. More clear space is needed for a walking route.';
}

export function CharacterAnimationSection({entity,route,onChange}:{entity:Instance;route:GroundRoute | null | undefined;onChange:(patch:Partial<Instance>)=>void}) {
  return <InspectorSection sectionId="character-animation" title="Animation">
    <Field>Animation<SelectInput aria-label="Character animation" value={entity.characterAnimation ?? 'auto'} onValueChange={value => onChange({characterAnimation:value as NonNullable<Instance['characterAnimation']>})}>
      <SelectOption value="auto">Automatic</SelectOption><SelectOption value="walk">Walk</SelectOption><SelectOption value="idle">Idle</SelectOption>
    </SelectInput></Field>
    <FieldMessage>{motionDescription(route)}</FieldMessage>
  </InspectorSection>;
}
