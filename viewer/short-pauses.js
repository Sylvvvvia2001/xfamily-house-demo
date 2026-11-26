// Apply the validated, day-specific transitions before instantiating the motion runtime.
export function bindShortPauses(motion, document, participant, date) {
  if (document.version !== 'contextual-replay-pause.1' || document.participant !== participant || document.date !== date)
    throw Error('Short-pause bindings do not match this day.');
  const edits = new Map(document.edits.map(edit => [edit.original, edit]));
  const old = motion.segments;
  motion.segments = old.flatMap((s, index) => {
    const edit = edits.get(s.id);
    if (!edit) return [s];
    if (s.privacy || s.outside || s.executionStatus !== 'unresolved_graph_interval' ||
        s.start !== edit.start || s.end !== edit.end || old[index + 1]?.id !== edit.successor ||
        edit.segments[0]?.start !== s.start || edit.segments.at(-1)?.end !== s.end)
      throw Error('Stale short-pause binding for ' + s.id);
    const next = old[index + 1];
    next.previousStepId = edit.segments.at(-1).id;
    if (next.carryFromStep === s.id) next.carryFromStep = next.previousStepId;
    next.blend_seconds = Math.max(next.blend_seconds || 0, Math.min(.3, (next.end-next.start)*.2));
    edits.delete(s.id);
    return edit.segments;
  });
  if (edits.size) throw Error('A short-pause source interval is missing.');
}

export function bindShortPauseProps(props, document) {
  const events = document.edits.flatMap(edit => edit.phoneEvents);
  if (events.length)
    props.phone.events = [...props.phone.events, ...events].sort((a,b) => (a.contact?.at ?? a.start) - (b.contact?.at ?? b.start));
}
