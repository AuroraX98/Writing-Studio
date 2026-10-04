(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.WritingGenres = api;
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";

  const types = [
    { id: "fiction", label: "Fiction", defaultGenre: "novel", note: "Novels, short stories, and genre fiction." },
    { id: "nonfiction", label: "Nonfiction", defaultGenre: "reflective", note: "Explanatory, practical, and reflective books." },
    { id: "memoir", label: "Memoir", defaultGenre: "chronological", note: "Life stories shaped by time, theme, or connected strands." },
    { id: "poetry", label: "Poetry", defaultGenre: "lyric", note: "Individual poems and connected collections." },
    { id: "screenplay", label: "Screenplay", defaultGenre: "feature", note: "Film and television scripts told through action and image." },
    { id: "essays", label: "Essays", defaultGenre: "personal", note: "Personal, critical, researched, and braided essays." },
    { id: "academic", label: "Academic", defaultGenre: "researcharticle", note: "Research writing shaped by questions, sources, and argument." },
  ];
  const defaults = Object.fromEntries(types.map(({ id, defaultGenre }) => [id, defaultGenre]));
  // Keep old stored ids valid, while presenting one canonical choice in the UI.
  const hiddenAliases = { fiction: ["scifi"] };
  const roleNames = {
    opening: "Opening",
    development: "Development",
    turning: "Turning point",
    application: "Action / application",
    closing: "Closing",
  };

  const rolePrompts = {
    fiction: {
      opening: "Ground us in a character and situation. What draws us in or feels unsettled?",
      development: "What is the character trying now, and how does the situation change?",
      turning: "What new knowledge, choice, or event redirects the story?",
      application: "What does the character do with what they know, and what follows?",
      closing: "What resolves, and what consequence or uncertainty remains?",
    },
    nonfiction: {
      opening: "What reader question or practical concern begins this part of the book?",
      development: "What connected idea can you explain with evidence and examples?",
      turning: "What complication or new perspective changes the reader’s understanding?",
      application: "Where can the reader see or try this idea in a concrete case?",
      closing: "What can the reader reasonably take away, given the evidence?",
    },
    memoir: {
      opening: "Which lived moment introduces the thread this part of your memoir follows?",
      development: "Which experience or relationship adds depth to the thread?",
      turning: "What event changed your direction or what you understood at the time?",
      application: "How did you respond, or live with what happened?",
      closing: "From where you are now, what has changed and what remains open?",
    },
    poetry: {
      opening: "What image, voice, sound, or question opens this sequence?",
      development: "How does the next poem deepen or answer the sequence’s early music or image?",
      turning: "Where does the sequence shift its image, speaker, rhythm, or point of view?",
      application: "What concrete image or sound lets the central feeling take shape?",
      closing: "What resonance or silence should remain after the last poem?",
    },
    screenplay: {
      opening: "What can the audience see or hear that establishes the scene’s situation?",
      development: "What does the character pursue in this sequence, and what blocks them?",
      turning: "What visible event changes the plan, relationship, or stakes?",
      application: "What action makes the character’s decision legible on screen?",
      closing: "What image, action, or unanswered question carries into the next sequence?",
    },
    essays: {
      opening: "What moment, question, or claim gives this essay its starting point?",
      development: "Which scene, idea, or source complicates the first impression?",
      turning: "What detail makes you reconsider the essay’s initial assumption?",
      application: "How does the idea meet a specific experience, example, or case?",
      closing: "What can you now say with care, and what remains unresolved?",
    },
    academic: {
      opening: "What research question, claim, or gap does this section address?",
      development: "What evidence and reasoning support the section’s next step?",
      turning: "What counterevidence, limitation, or result revises the argument?",
      application: "How does the method or analysis answer the research question?",
      closing: "What does this section establish, and what question follows?",
    },
  };

  const entry = (name, items, map) => ({ name, items, map });
  // New entries extend the app's existing library. Legacy entries remain in the app
  // and take precedence when mergeIntoLibrary combines the two catalogs.
  const library = {
    fiction: {
      novel: entry("General / literary", [
        ["Point of view & setting", "Whose experience are we following? Where and when are we?"],
        ["Desire", "What does this character want, fear, or try to understand here?"],
        ["Friction", "What resists that desire: another person, an inner conflict, or a circumstance?"],
        ["Change", "What action, discovery, or realization leaves the situation different?"],
        ["Forward connection", "What consequence, image, or question carries into the next chapter?"],
      ], [
        ["Arrival", "Establish a person, a situation, and something unresolved."],
        ["Disruption", "Introduce a change that makes the old situation harder to maintain."],
        ["Development", "Explore attempts, relationships, and growing consequences."],
        ["Reconsideration", "Deepen or challenge what the character believes or wants."],
        ["Decisive movement", "Bring a central tension to a meaningful choice or confrontation."],
        ["Aftermath", "Show what has changed and what remains open."],
      ]),
      mystery: entry("Mystery", [
        ["Investigative question", "What is the investigator trying to find out in this chapter?"],
        ["Information", "Is there a clue, witness account, discovery, or absence worth noticing? A clue is not required in every chapter."],
        ["Obstacle or suspicion", "What prevents progress, creates doubt, or makes an interpretation uncertain?"],
        ["Changed understanding", "What does the investigator now believe, and what might still be mistaken?"],
        ["Next lead or consequence", "What follows from this chapter: another lead, a setback, or a personal cost?"],
      ], [
        ["Unanswered event", "Introduce the central mystery and someone who needs an answer."],
        ["Initial inquiry", "Establish possible explanations and the investigation."],
        ["Complications", "Develop evidence, resistance, and competing interpretations."],
        ["Reassessment", "Let discoveries change the direction of the inquiry."],
        ["Solution tested", "Connect the evidence and test the explanation through action."],
        ["Consequences", "Resolve the main question and show its human impact."],
      ]),
      thriller: entry("Thriller / suspense", [
        ["Threat", "What danger exists, and who is affected?"],
        ["Immediate goal", "What must someone accomplish or prevent? Is time a factor?"],
        ["Resistance", "What blocks action or makes a choice risky?"],
        ["Shift in pressure", "Does danger rise, briefly ease, or become clearer? Vary the intensity."],
        ["Consequence", "What new cost, uncertainty, or urgent decision follows?"],
      ], [
        ["Danger emerges", "Give the reader a reason to worry and a person to follow."],
        ["Response", "Show attempts to understand, escape, or stop the threat."],
        ["Escalation", "Increase the costs and complicate the available choices."],
        ["Setback or reversal", "Change what the protagonist knows or can do."],
        ["Confrontation", "Resolve the central danger through consequential action."],
        ["Fallout", "Show survival, loss, and what the outcome changes."],
      ]),
      romance: entry("Romance", [
        ["Relationship movement", "How does this chapter move the central relationship closer, further apart, or into new territory?"],
        ["Individual wants", "What does each person want beyond the relationship?"],
        ["Connection or tension", "What interaction makes attraction, incompatibility, or trust tangible?"],
        ["Risk & choice", "What might someone reveal, protect, misunderstand, or choose?"],
        ["Emotional consequence", "How does the interaction affect the next meeting or decision?"],
      ], [
        ["Two lives", "Establish the central people and their individual circumstances."],
        ["Encounter", "Create a reason their lives become connected."],
        ["Growing connection", "Develop attraction, trust, and meaningful differences."],
        ["Relationship difficulty", "Bring obstacles and conflicting needs into sharper focus."],
        ["Choice & repair", "Show choices that make a lasting relationship possible."],
        ["Optimistic resolution", "Resolve the central love story with an emotionally satisfying, hopeful ending."],
      ]),
      fantasy: entry("Fantasy", [
        ["Character goal", "What does someone want in this scene or chapter?"],
        ["Relevant world detail", "Which custom, place, creature, or magical condition affects the action?"],
        ["Limits & costs", "What can this person or magic do, and what consequence matters here?"],
        ["Conflict or discovery", "What encounter changes the character or their understanding?"],
        ["Result", "What decision, cost, or discovery carries the story onward?"],
      ], [
        ["Life in this world", "Introduce a character and world through lived action."],
        ["New demand", "Create a disturbance, invitation, or conflict."],
        ["Exploration", "Develop relationships and reveal the world as it matters."],
        ["Limits exposed", "Show the costs and complications of the path taken."],
        ["Decisive choice", "Bring character and world conflicts together."],
        ["Changed world", "Show consequences for the character and their surroundings."],
      ]),
      scifi: entry("Science fiction", [
        ["Human goal", "What does a person or other viewpoint character want here?"],
        ["Speculative condition", "What technology, environment, or social possibility affects that goal?"],
        ["Constraint", "What limitation, tradeoff, or consequence makes the premise matter?"],
        ["Encounter or decision", "How does someone act when faced with this condition?"],
        ["Implication", "What has changed for the character, community, or larger question?"],
      ], [
        ["Ordinary life here", "Make the speculative setting concrete through a character."],
        ["Premise in motion", "Introduce a change or problem created by the speculative condition."],
        ["Exploration", "Show attempts and their personal or social effects."],
        ["Complications", "Test assumptions and reveal limits or unforeseen costs."],
        ["Consequential choice", "Resolve the central conflict through an earned decision."],
        ["Implications", "Show the resulting life or society and any remaining questions."],
      ]),
      sciencefiction: entry("Science fiction", [
        ["Human-scale goal", "What does the viewpoint character need before the speculative idea takes over the scene?"],
        ["Changed condition", "Which technology, environment, or social possibility alters the ordinary choices?"],
        ["Constraint", "What limit, tradeoff, or unexpected effect makes the premise consequential?"],
        ["Human response", "How do different people interpret or use the same condition?"],
        ["Wider implication", "What changed for a person, community, or assumption about the future?"],
      ], [
        ["Ordinary life in the premise", "Let a character use or live with one speculative condition."],
        ["Disruption", "Show what changes when the condition fails, spreads, or is newly understood."],
        ["Experiment", "Follow attempts to adapt, test, or resist the new circumstances."],
        ["Unintended effect", "Bring forward costs or social effects no one first expected."],
        ["Decision", "Resolve the central problem through a choice shaped by the premise."],
        ["Aftereffect", "Show what the choice means for daily life and the larger question."],
      ]),
      horror: entry("Horror", [
        ["Source of unease", "What feels wrong, threatening, or not yet understood?"],
        ["Personal stake", "What does the danger threaten in this character’s body, relationships, or sense of self?"],
        ["Boundary", "What limit, taboo, or protective belief is being tested?"],
        ["Pressure and relief", "Does this moment intensify dread, offer a pause, or make the threat more intimate?"],
        ["Aftereffect", "What fear, loss, or new knowledge changes what the character can do next?"],
      ], [
        ["Uneasy ordinary", "Give the reader a recognizable life with a disturbance at its edge."],
        ["First breach", "Let the threat cross a boundary the character trusted."],
        ["Attempts to explain", "Show efforts to name, avoid, or contain what is happening."],
        ["Isolation or exposure", "Make the danger harder to ignore and more personal."],
        ["Confrontation", "Bring the character into direct contact with the threat."],
        ["Haunting aftermath", "Show what survives, changes, or cannot be restored."],
      ]),
      historical: entry("Historical fiction", [
        ["Period grounding", "Which detail of time and place affects this moment directly?"],
        ["Character’s aim", "What does this person want within the limits and possibilities of their time?"],
        ["Social pressure", "Which custom, institution, or power difference shapes the choice?"],
        ["Human connection", "How does a relationship make the historical circumstance personal?"],
        ["Consequence", "What changes, and what should remain uncertain or distinct from present-day assumptions?"],
      ], [
        ["Grounded beginning", "Place a character in a particular time and ordinary routine."],
        ["Historical pressure", "Introduce a public event or local condition that reaches private life."],
        ["Negotiation", "Follow attempts to act within the era’s constraints."],
        ["Turning conditions", "Let events alter loyalties, safety, or available choices."],
        ["Personal decision", "Resolve the character’s central conflict through a situated choice."],
        ["Later meaning", "Show the immediate aftermath without claiming more certainty than the story allows."],
      ]),
      adventure: entry("Adventure", [
        ["Destination or aim", "What is the character trying to reach, retrieve, or accomplish?"],
        ["Terrain and conditions", "Which feature of the route changes what is possible?"],
        ["Resource", "What skill, tool, ally, or supply matters in this stretch?"],
        ["Setback", "What makes progress cost more than expected?"],
        ["Choice under pressure", "What does the character risk or leave behind to keep going?"],
      ], [
        ["Call to movement", "Give the character a reason to leave the familiar setting."],
        ["Departure", "Set the goal, companions, and first conditions of travel."],
        ["Tests along the way", "Use encounters to reveal skill, limits, and relationships."],
        ["Loss or detour", "Make the goal harder to reach and change the plan."],
        ["Arrival and action", "Bring the character to the decisive task or confrontation."],
        ["Return changed", "Show what the journey altered and what it cost."],
      ]),
      literary: entry("Literary fiction", [
        ["Attention", "What small event or detail carries unusual weight for this character?"],
        ["Private want", "What does the character desire but struggle to name?"],
        ["Social texture", "Which habit, relationship, or setting reveals the character’s world?"],
        ["Tension beneath the moment", "What is said, withheld, or misunderstood?"],
        ["Resonance", "What image, choice, or shift deepens the story without closing every question?"],
      ], [
        ["A life in motion", "Introduce a person through an ordinary pattern and its pressure points."],
        ["Dislocation", "Let a modest event disturb what felt settled."],
        ["Accumulation", "Build meaning through scenes, relationships, and recurring details."],
        ["Reinterpretation", "Allow a new experience to change the meaning of an earlier one."],
        ["Quiet decision", "Bring an inner or relational tension to a consequential choice."],
        ["Open consequence", "End with a changed perspective and room for the reader to think."],
      ]),
      youngadult: entry("Young adult", [
        ["Immediate want", "What does the young protagonist want on their own terms?"],
        ["Voice and setting", "What details make this character’s daily world specific to them?"],
        ["Agency and limits", "Where can the character act, and where do adults or institutions hold power?"],
        ["Peer connection", "How do friendship, attraction, family, or belonging affect the choice?"],
        ["Emerging perspective", "What does the protagonist decide or understand for themselves?"],
      ], [
        ["Current world", "Establish the protagonist’s routines, relationships, and immediate concern."],
        ["Change arrives", "Introduce a disruption that makes the old approach stop working."],
        ["Trying for agency", "Show experiments, alliances, and mistakes as the protagonist takes action."],
        ["Costs become clear", "Bring competing loyalties and consequences into view."],
        ["Self-directed choice", "Let the protagonist act from a perspective they have developed."],
        ["Next horizon", "Resolve the central struggle while opening a believable next stage."],
      ]),
      children: entry("Children’s fiction", [
        ["Clear want", "What simple, meaningful goal can the child character pursue?"],
        ["Concrete setting", "Which vivid place or object shapes the action?"],
        ["Manageable obstacle", "What gets in the way in a way a young reader can follow?"],
        ["Play or discovery", "What surprise, joke, or imaginative turn keeps the moment lively?"],
        ["Emotional landing", "What reassuring, funny, or thoughtful change ends the chapter?"],
      ], [
        ["Meet the character", "Introduce the child and a recognizable wish or worry."],
        ["Problem appears", "Give the character a clear challenge to solve."],
        ["Try and discover", "Let efforts lead to new information or playful complications."],
        ["Bigger attempt", "Give the character a chance to use what they have learned."],
        ["Solution", "Resolve the central problem through understandable action."],
        ["Warm close", "End with a satisfying feeling, laugh, or small invitation onward."],
      ]),
    },
    nonfiction: {
      informative: entry("Informative / explanatory", [
        ["Reader question", "What should the reader understand by the end of this chapter?"],
        ["Explanation", "Define the key idea and develop it in a logical order."],
        ["Support", "What source, data, reasoning, or documented example supports it?"],
        ["Nuance", "What limit, disagreement, or exception changes how it should be understood?"],
        ["Takeaway & bridge", "What is the useful takeaway, and why does the next topic follow?"],
      ], [
        ["Scope", "Introduce the main question, audience, and boundaries."],
        ["Foundations", "Explain the terms and background the reader needs."],
        ["Core topics", "Develop connected ideas in a useful order."],
        ["Complexities", "Examine examples, competing explanations, and limitations."],
        ["Synthesis", "Connect the findings into a clearer understanding."],
        ["Closing", "Answer the main question within the evidence available."],
      ]),
      selfhelp: entry("Self-help / personal growth", [
        ["Recognizable difficulty", "What real situation or reader concern makes this chapter relevant?"],
        ["Useful idea", "What perspective or skill might help, and why?"],
        ["Example & support", "Show an example and explain the basis for the advice."],
        ["Practice", "Offer an optional exercise with clear, manageable steps."],
        ["Limits & reflection", "What may vary by person? How can the reader reflect on an attempt?"],
      ], [
        ["Reader concern", "Describe the difficulty and realistic aim of the book."],
        ["Understanding", "Explain useful concepts and relevant context."],
        ["Core approaches", "Introduce practices with examples and reasons."],
        ["Obstacles", "Address setbacks, limitations, and adaptations."],
        ["Integration", "Help the reader connect practices to everyday life."],
        ["Next steps", "Offer a flexible way to continue and review progress."],
      ]),
      reflective: entry("Reflective / spiritual", [
        ["Lived moment", "Start with an experience, observation, or question worth exploring."],
        ["Meaning & inquiry", "What did you think or believe then? What did you notice when you looked closer?"],
        ["Perspective & sources", "Distinguish your experience, interpretation, faith, and any source teaching."],
        ["Example or contemplation", "Develop the idea through a concrete example, image, or careful reflection."],
        ["Invitation & transition", "Offer an optional question or practice; connect to what follows without forcing a conclusion."],
      ], [
        ["Opening question", "Introduce a lived experience and the question it raises."],
        ["Looking closer", "Explore what you noticed, thought, or believed."],
        ["Developing understanding", "Connect experiences and ideas while retaining their distinctions."],
        ["Complications", "Make room for doubt, exceptions, and unresolved questions."],
        ["Living with it", "Show attempts to apply or contemplate the understanding."],
        ["Return & continuation", "Revisit the opening question from your present perspective."],
      ]),
      practical: entry("Practical guide / how-to", [
        ["Outcome & starting point", "What should the reader be able to do? What must they already have or know?"],
        ["Steps", "Give actions in an order the reader can follow."],
        ["Worked example", "Demonstrate the process with concrete inputs and a result."],
        ["Troubleshooting", "What commonly goes wrong, and what can the reader try?"],
        ["Completion check", "How can the reader check the result and prepare for the next step?"],
      ], [
        ["Goal & scope", "Explain what the guide helps the reader do."],
        ["Preparation", "Cover prerequisites, materials, and relevant precautions."],
        ["Basic process", "Teach the core actions in a workable sequence."],
        ["Practice & variations", "Show examples and adapt the method to different cases."],
        ["Troubleshooting", "Address difficulties and ways to assess results."],
        ["Independent use", "Provide a useful reference and next steps."],
      ]),
      history: entry("History / biography", [
        ["Time, place & context", "Orient the reader to the period, setting, and people."],
        ["Event or decision", "What happened, and who acted?"],
        ["Sources", "Which records support the account? Where do sources disagree or fall short?"],
        ["Interpretation", "Explain causes or significance while marking uncertainty and perspective."],
        ["Consequence & link", "What followed, and how does this connect to the larger account?"],
      ], [
        ["Subject & scope", "Define the person, period, or question being explored."],
        ["Background", "Establish the conditions needed to understand the account."],
        ["Key developments", "Follow events or themes using traceable sources."],
        ["Turning points", "Explore decisions, pressures, and contested interpretations."],
        ["Consequences", "Show later effects and different perspectives."],
        ["Assessment", "Consider significance and the limits of what can be known."],
      ]),
      business: entry("Business", [
        ["Business question", "What decision or operating problem does this section help a reader address?"],
        ["Context", "Which team, market, customer, or constraint shapes the situation?"],
        ["Evidence", "What data, case, or observed result supports the claim?"],
        ["Tradeoff", "What cost, risk, or competing aim should be considered?"],
        ["Action and measure", "What could a reader try, and how could they tell what happened?"],
      ], [
        ["Purpose and audience", "Name the business challenge and who needs a useful answer."],
        ["Shared terms", "Establish the concepts and conditions the reader must understand."],
        ["Options", "Compare approaches using evidence and realistic examples."],
        ["Tradeoffs", "Examine risks, constraints, and cases where an approach may not fit."],
        ["Implementation", "Show how decisions can become a workable plan."],
        ["Review and adapt", "Offer measures and questions for adjusting course."],
      ]),
      popularscience: entry("Popular science", [
        ["Curiosity", "What puzzling observation or question invites explanation?"],
        ["Plain-language idea", "What scientific concept helps explain the observation?"],
        ["Evidence", "Which study, measurement, or example supports the explanation?"],
        ["Limits", "What is not yet known, disputed, or easy to overstate?"],
        ["Meaning", "How does this finding change what a reader can reasonably picture or ask?"],
      ], [
        ["Question in the world", "Begin with an observable puzzle or everyday phenomenon."],
        ["Scientific frame", "Introduce the concepts and methods needed to examine it."],
        ["Evidence gathered", "Explain key findings through clear examples and sources."],
        ["Competing explanations", "Compare interpretations and state uncertainty plainly."],
        ["What follows", "Connect the evidence to its practical or conceptual implications."],
        ["Open questions", "Summarize what is known and what researchers still explore."],
      ]),
      travel: entry("Travel writing", [
        ["Place and moment", "Where are you, and what specific detail first catches your attention?"],
        ["Purpose of travel", "What brought you here or what are you trying to understand?"],
        ["People and perspective", "Whose knowledge or experience gives this place more depth?"],
        ["Sensory detail", "What sounds, textures, weather, food, or movement anchor the scene?"],
        ["Reflection with care", "What did the experience make you reconsider without speaking for others?"],
      ], [
        ["Departure question", "Set out with a reason, expectation, or uncertainty about the journey."],
        ["First arrival", "Show the first encounter with place through particular details."],
        ["Local texture", "Build understanding through people, routines, and grounded observation."],
        ["Expectation unsettled", "Let a conversation or event complicate the traveler’s view."],
        ["Meaning in context", "Connect personal experience with what the place means to those who live there."],
        ["Leaving and looking back", "Return to the opening question with a more limited, informed perspective."],
      ]),
      creative: entry("Creative nonfiction", [
        ["Factual scene", "What specific, supportable moment can carry the reader into the subject?"],
        ["Narrative question", "What do you or the reader want to know next?"],
        ["Verified detail", "Which records, memories, or observations support this account?"],
        ["Meaning and uncertainty", "What can you infer, and where should the account leave room?"],
        ["Shape and pacing", "Where should scene, context, or reflection change the reader’s view?"],
      ], [
        ["Entry point", "Open on a compelling fact, scene, or question."],
        ["Necessary context", "Give only the background needed to follow the central thread."],
        ["Investigation", "Develop the account through scenes, sources, and specific evidence."],
        ["Complication", "Let new facts or perspectives unsettle the initial interpretation."],
        ["Convergence", "Bring the narrative strands or evidence together carefully."],
        ["Grounded ending", "Offer a resonant conclusion within what the facts can support."],
      ]),
    },
    memoir: {
      chronological: entry("Chronological memoir", [
        ["Time & place", "Where are we in your life, and what does the reader need to know?"],
        ["Lived scene", "Show a specific event through action, detail, and your experience."],
        ["Want or difficulty", "What did you want, fear, or struggle with at that time?"],
        ["Then & now", "Where useful, reflect on what you understood then and what you see now."],
        ["Change & connection", "What shifted? What consequence connects this period to the next?"],
      ], [
        ["Opening lens", "Introduce the central experience or question."],
        ["Earlier context", "Establish relevant background without covering every year."],
        ["Developing events", "Follow selected experiences in time order."],
        ["Significant shifts", "Explore moments that changed your direction or understanding."],
        ["Consequences", "Show what followed and how you responded."],
        ["Present perspective", "Return to the central theme from where you are now."],
      ]),
      thematic: entry("Thematic memoir", [
        ["Chapter theme", "What question or recurring experience unites this chapter?"],
        ["Selected moments", "Choose scenes from your life that develop this theme."],
        ["Orientation", "Make changes of time, place, and age clear."],
        ["Reflection", "What do these moments reveal together, without forcing a lesson?"],
        ["Connection", "How does this theme deepen or complicate the next one?"],
      ], [
        ["Central thread", "Establish the question connecting the selected experiences."],
        ["First theme", "Explore one aspect through concrete scenes."],
        ["Related themes", "Add perspectives that deepen the central thread."],
        ["Tension", "Place conflicting experiences or meanings in conversation."],
        ["Connections", "Show what emerges across the themes."],
        ["Return", "Revisit the central question with greater depth."],
      ]),
      braided: entry("Braided memoir", [
        ["Active strand", "Which period, relationship, or line of inquiry are we following now?"],
        ["Concrete moment", "Anchor this strand in an event or observation."],
        ["Time & transition", "Help the reader recognize movement to another strand."],
        ["Resonance", "How does this strand echo, challenge, or illuminate another?"],
        ["Developing meaning", "What emerges as the strands come together or remain in tension?"],
      ], [
        ["Introduce strands", "Establish the connected times, experiences, or questions."],
        ["Develop each strand", "Give each line enough scene and context to stand on its own."],
        ["Alternate deliberately", "Move between strands through clear transitions."],
        ["Deepen connections", "Let parallels and differences accumulate."],
        ["Bring into relation", "Draw the strands closer where their connection matters."],
        ["Closing perspective", "Show what their relationship reveals, including what stays unresolved."],
      ]),
      comingofage: entry("Coming-of-age memoir", [
        ["Age and setting", "Where were you in your life, and what shaped your day-to-day world?"],
        ["Want for independence", "What were you trying to choose or understand for yourself?"],
        ["Relationship pressure", "How did family, peers, or community affect that attempt?"],
        ["Then and now", "What did you know then, and what can you see from your present perspective?"],
        ["Change without a lesson", "What shifted in your understanding, even if it did not resolve everything?"],
      ], [
        ["Early sense of self", "Show a younger self in a particular place and set of relationships."],
        ["A question takes shape", "Introduce a desire, conflict, or change the narrator cannot yet explain."],
        ["Testing boundaries", "Follow attempts at independence and the responses they meet."],
        ["A changed understanding", "Let an experience revise the narrator’s view of self or others."],
        ["Living with the change", "Show consequences through later choices and relationships."],
        ["Present-day perspective", "Look back with compassion while preserving what remains complicated."],
      ]),
      travel: entry("Travel memoir", [
        ["Journey in time", "Where are you going, and what personal question travels with you?"],
        ["Lived encounter", "What scene shows your experience without turning one moment into a claim about everyone?"],
        ["Local perspective", "What do people who live there show or tell you about the place?"],
        ["Inner and outer change", "How does the journey alter your assumptions, relationships, or plans?"],
        ["Present reflection", "What can you say now while respecting what you still do not know?"],
      ], [
        ["Reason for leaving", "Establish the journey and the private question behind it."],
        ["First encounters", "Ground the reader in place through specific scenes and people."],
        ["Deeper involvement", "Show how time, listening, and daily events complicate first impressions."],
        ["Disruption", "Let a difficulty or meeting redirect the journey or its meaning."],
        ["Return or departure", "Show what the narrator carries forward and what remains with the place."],
        ["Looking back", "Revisit the starting question without pretending one journey answers everything."],
      ]),
    },
    poetry: {
      lyric: entry("Lyric poetry", [
        ["Speaking voice", "Who is speaking, and what makes this voice particular?"],
        ["Image or sound", "Which concrete image, rhythm, or sound begins the poem’s movement?"],
        ["Emotional turn", "Where does the speaker’s feeling or attention shift?"],
        ["Form and pressure", "How does line, stanza, repetition, or silence shape the feeling?"],
        ["After-resonance", "What remains for a reader to hear or picture after the ending?"],
      ], [
        ["First image", "Open with a voice, image, or sound that makes the poem present."],
        ["Attention gathers", "Let a detail or repeated sound deepen the central feeling."],
        ["Tension enters", "Introduce a contrast, question, or interruption."],
        ["Turn", "Shift the speaker’s view, address, or scale of attention."],
        ["Landing", "End with an image, action, or line break that feels earned."],
        ["Sequence echo", "If part of a collection, let the poem’s final resonance connect forward."],
      ]),
      narrative: entry("Narrative poetry", [
        ["Speaker and situation", "Who is telling the poem, and what is happening now?"],
        ["Want or conflict", "What does the speaker or central figure want, and what blocks it?"],
        ["Concrete action", "Which event can the reader picture unfolding?"],
        ["Pacing and sound", "How do line breaks, rhythm, or repetition shape the story’s pace?"],
        ["Story consequence", "What changes by the end, and what feeling does the telling leave?"],
      ], [
        ["Enter the moment", "Introduce a speaker, place, and immediate situation."],
        ["Desire appears", "Make the goal or conflict clear through action and image."],
        ["Complication", "Let a choice, memory, or other person alter the course."],
        ["Crisis or decision", "Bring the central pressure to a decisive moment."],
        ["Outcome", "Show what happens without explaining away its emotional complexity."],
        ["Echo", "Close on an image or sound that carries the story beyond its events."],
      ]),
      spokenword: entry("Spoken word", [
        ["Audience and address", "Who is being spoken to, and what relationship does the speaker claim?"],
        ["Central assertion", "What does the speaker need to say in a line a listener can follow?"],
        ["Oral rhythm", "Where do breath, stress, repetition, or silence guide the delivery?"],
        ["Specific evidence", "What scene, detail, or image gives the claim a human ground?"],
        ["Performance ending", "What final sound or image should remain with the audience?"],
      ], [
        ["Address", "Establish the speaker’s presence and the audience being addressed."],
        ["Claim and context", "Name the subject and give listeners enough background to enter."],
        ["Images and examples", "Build the idea through memorable details and lived moments."],
        ["Refrain or escalation", "Return to a line or raise the emotional and rhythmic pressure."],
        ["Turn in address", "Let the speaker’s relationship to the audience or claim change."],
        ["Final beat", "End with a clear image, sound, or invitation suited to performance."],
      ]),
      collection: entry("Poetry collection", [
        ["Collection thread", "What image, question, place, or tension connects these poems?"],
        ["Poem’s own shape", "What does this poem do on its own, beyond serving the collection?"],
        ["Neighboring poems", "How does it echo or contrast with poems around it?"],
        ["Pacing and variety", "Does form, length, voice, or intensity vary across the sequence?"],
        ["Section transition", "What changes as the reader moves into the next group of poems?"],
      ], [
        ["Opening invitation", "Introduce the collection’s voice, image, or central field of attention."],
        ["First cluster", "Gather poems that establish the subject from distinct angles."],
        ["Countervoice", "Introduce contrast or a poem that unsettles the pattern."],
        ["Deepening sequence", "Let recurring images gather new meanings across the collection."],
        ["Strongest turn", "Place a poem or section that changes the reader’s understanding."],
        ["Closing resonance", "End with a poem that offers an echo or opening rather than a forced answer."],
      ]),
    },
    screenplay: {
      feature: entry("Feature film", [
        ["Visible objective", "What can the audience see the protagonist trying to do?"],
        ["Scene action", "What changes within the scene through behavior, not explanation?"],
        ["Obstacle", "What person, circumstance, or choice blocks progress?"],
        ["Visual information", "What can be shown through setting, prop, image, or silence?"],
        ["Sequence consequence", "How does this beat alter the next goal or expectation?"],
      ], [
        ["Opening image and world", "Establish the protagonist’s world through action and a visual detail."],
        ["Disruption and response", "Introduce a problem and the first attempt to address it."],
        ["Progress with complications", "Build sequences where each success or failure changes the plan."],
        ["Crisis and choice", "Bring the protagonist to a decision that carries real cost."],
        ["Climax", "Resolve the central dramatic question through visible action."],
        ["Final image", "Show how the outcome changes the protagonist’s world."],
      ]),
      tvpilot: entry("Television pilot", [
        ["Series world", "What setting, job, family, or community can generate more stories?"],
        ["Character engine", "What does the lead repeatedly want or avoid?"],
        ["Pilot problem", "What specific case, conflict, or disruption makes this episode move?"],
        ["Ensemble dynamics", "How do other characters complicate the lead’s approach?"],
        ["Next-episode pull", "What unresolved consequence invites another episode?"],
      ], [
        ["Opening promise", "Show the tone and story world in a memorable scene."],
        ["Lead and ensemble", "Introduce key characters through what they do to one another."],
        ["Episode problem", "Give the pilot a conflict with its own forward movement."],
        ["Series engine", "Reveal how the world can create continuing stories."],
        ["Pilot resolution", "Deliver a satisfying shift in the episode’s main problem."],
        ["Continuing question", "End with a character or story thread that opens the series beyond the pilot."],
      ]),
      shortfilm: entry("Short film", [
        ["One clear situation", "What can the audience grasp quickly about the moment?"],
        ["Immediate want", "What does the central character need now?"],
        ["Efficient obstacle", "What single pressure makes the goal difficult?"],
        ["Visual turn", "What image or action changes the meaning of the situation?"],
        ["Lasting impression", "What feeling or question gives the ending weight?"],
      ], [
        ["Drop into a moment", "Begin close to the central situation rather than explaining every background detail."],
        ["Want becomes visible", "Show a concrete goal through behavior."],
        ["Obstacle tightens", "Use a small number of complications with clear effects."],
        ["Choice or reveal", "Turn the situation through one decisive action or discovery."],
        ["Immediate outcome", "Let the audience see the consequence of the choice."],
        ["Final impression", "Close on a resonant image, gesture, or sound."],
      ]),
    },
    essays: {
      personal: entry("Personal essay", [
        ["Lived opening", "What particular moment brings the reader into the essay?"],
        ["Question or tension", "What did you not understand or know how to say then?"],
        ["Selected scene", "Which detail lets the reader experience rather than just hear about it?"],
        ["Reflection", "What do you see now, and what still resists a neat conclusion?"],
        ["Shape", "How does the ending change the opening’s meaning?"],
      ], [
        ["Scene or question", "Begin with a precise moment that carries the essay’s tension."],
        ["Context", "Give only the background needed to understand the moment."],
        ["Complication", "Add a scene, memory, or counterthought that challenges the first reading."],
        ["Reconsideration", "Let the writer’s view change or become more precise."],
        ["Return", "Reconnect with the opening moment from the new perspective."],
        ["Resonant close", "Leave a specific insight or honest uncertainty with the reader."],
      ]),
      critical: entry("Critical essay", [
        ["Subject and claim", "What work, idea, or question are you examining?"],
        ["Evidence", "Which passage, feature, or example supports the reading?"],
        ["Interpretation", "How does the evidence support more than a surface summary?"],
        ["Alternative view", "What other reading or limitation should be considered?"],
        ["Contribution", "What does this analysis help readers notice?"],
      ], [
        ["Question", "Introduce the work or problem and the question guiding the essay."],
        ["Terms and context", "Define the lens and context needed for the argument."],
        ["Close analysis", "Develop the reading from specific evidence."],
        ["Counterreading", "Consider an alternative interpretation or weakness in the claim."],
        ["Refined claim", "State what the evidence supports after the challenge."],
        ["Implication", "Explain what this reading makes visible or newly debatable."],
      ]),
      braided: entry("Braided essay", [
        ["Active strand", "Which story, research thread, or image are we following here?"],
        ["Distinct purpose", "What does this strand add that the others cannot?"],
        ["Clear transition", "What cue helps the reader recognize the change of strand?"],
        ["Resonance or contrast", "How does one strand alter the meaning of another?"],
        ["Convergence", "What becomes visible when the strands sit beside each other?"],
      ], [
        ["First thread", "Introduce a concrete scene or question that can recur."],
        ["Second thread", "Add a distinct line of material with its own movement."],
        ["Alternation", "Move between strands with clear transitions and growing resonance."],
        ["Complication", "Let a new fact or scene challenge the apparent connection."],
        ["Convergence", "Bring threads into relation where their meanings genuinely meet."],
        ["Open braid", "Close with a changed understanding or a connection still in progress."],
      ]),
      travel: entry("Travel essay", [
        ["Place-bound opening", "What specific detail makes this location present on the page?"],
        ["Reason to notice", "What question or experience guides the essay’s attention?"],
        ["People and context", "Whose voices or knowledge help the writer see beyond a first impression?"],
        ["Observed change", "What complicates the traveler’s initial expectation?"],
        ["Bounded reflection", "What can the writer conclude from this visit, and what cannot they claim?"],
      ], [
        ["Arrival", "Open on an encounter that gives the place texture."],
        ["Expectation", "Share the question or image the traveler brought along."],
        ["Listening and looking", "Develop understanding through detail, sources, and local perspectives."],
        ["Expectation shifts", "Let an event or conversation change the essay’s direction."],
        ["Meaning in context", "Connect the writer’s experience with the wider place carefully."],
        ["Departure", "Return to the opening question with appropriate limits."],
      ]),
      researched: entry("Researched essay", [
        ["Focused question", "What specific question can the essay answer with its available evidence?"],
        ["Source quality", "Which sources are relevant, reliable, and limited in what they show?"],
        ["Claim and support", "What is the central claim, and which evidence supports each step?"],
        ["Counterevidence", "What finding complicates or narrows the claim?"],
        ["Synthesis", "What can the reader understand after seeing the sources together?"],
      ], [
        ["Question and scope", "Set the inquiry and define what the essay can cover."],
        ["Background", "Establish key terms and context from dependable sources."],
        ["Evidence groups", "Organize sources by the ideas they support or challenge."],
        ["Analysis", "Explain how the evidence relates and where it remains incomplete."],
        ["Qualified answer", "Answer the question without exceeding what the evidence allows."],
        ["Further questions", "Show what the conclusion leaves open for further inquiry."],
      ]),
    },
    academic: {
      researcharticle: entry("Research article", [
        ["Research question", "What is the focused question the study addresses?"],
        ["Method and fit", "Why is this method appropriate for that question?"],
        ["Evidence and analysis", "What data or texts support the result, and how are they analyzed?"],
        ["Limitations", "What can the findings not establish?"],
        ["Contribution", "How does the work change or refine the field’s understanding?"],
      ], [
        ["Question and contribution", "State the research problem and why it matters to the field."],
        ["Relevant background", "Position the question within prior work."],
        ["Method", "Explain how the evidence was gathered or analyzed."],
        ["Results and interpretation", "Present findings and distinguish them from interpretation."],
        ["Discussion", "Relate findings to the question and existing scholarship."],
        ["Limits and next work", "State limitations and identify useful further questions."],
      ]),
      literaturereview: entry("Literature review", [
        ["Review question", "What question or scope organizes the scholarship being reviewed?"],
        ["Search boundaries", "Which dates, fields, methods, or sources are included?"],
        ["Patterns", "Where do studies converge, differ, or leave a gap?"],
        ["Quality and limits", "What strengths or limitations affect how the evidence can be used?"],
        ["Synthesis", "What does the body of work establish and leave unresolved?"],
      ], [
        ["Scope and purpose", "Define the review question and inclusion boundaries."],
        ["Field map", "Introduce major concepts, approaches, and lines of scholarship."],
        ["Evidence clusters", "Organize studies by shared questions or methods."],
        ["Disagreement and gaps", "Compare conflicting findings and areas with limited evidence."],
        ["Synthesis", "Explain what patterns become visible across the reviewed work."],
        ["Research direction", "Connect unresolved questions to a justified next step."],
      ]),
      dissertation: entry("Thesis / dissertation", [
        ["Central research question", "What problem will the project answer within its scope?"],
        ["Chapter contribution", "What distinct part of the argument does this chapter establish?"],
        ["Evidence and method", "What material supports this step, and how was it examined?"],
        ["Connection", "How does this chapter depend on or prepare for another chapter?"],
        ["Qualification", "What limitations or alternative interpretations should be named?"],
      ], [
        ["Problem and scope", "Establish the research problem, purpose, and boundaries."],
        ["Scholarly context", "Position the project in relevant scholarship and concepts."],
        ["Method and evidence", "Explain the approach and present the material it yields."],
        ["Analysis chapters", "Build the argument in steps that each contribute something distinct."],
        ["Synthesis", "Connect the results across chapters and address their limits."],
        ["Contribution and continuation", "State the project’s contribution and questions for future work."],
      ]),
      casestudy: entry("Case study", [
        ["Case and question", "Why is this case useful for examining the larger question?"],
        ["Context", "What setting, participants, and conditions must be understood?"],
        ["Evidence sources", "What records, observations, or interviews support the account?"],
        ["Analysis", "How do the details connect to the framework or question?"],
        ["Transfer limits", "What might apply elsewhere, and what remains case-specific?"],
      ], [
        ["Case selection", "Introduce the case and explain its relevance to the inquiry."],
        ["Setting and background", "Describe the context needed to interpret events."],
        ["Evidence record", "Present observations and sources with clear provenance."],
        ["Analysis", "Relate evidence to the research question or framework."],
        ["Alternative explanations", "Consider other interpretations and limits."],
        ["Implications", "State what the case suggests and what it cannot generalize."],
      ]),
    },
  };

  function mergeIntoLibrary(existing) {
    const merged = {};
    const source = existing && typeof existing === "object" ? existing : {};
    for (const { id } of types) {
      // Keep legacy entries as-is and add the new entries for the same type.
      merged[id] = { ...(library[id] || {}), ...(source[id] || {}) };
    }
    return merged;
  }

  function mergeRolePrompts(existing) {
    const merged = {};
    const source = existing && typeof existing === "object" ? existing : {};
    for (const { id } of types) merged[id] = { ...(rolePrompts[id] || {}), ...(source[id] || {}) };
    return merged;
  }

  function initializeGenreChoices(genres) {
    const result = { ...defaults, ...(genres && typeof genres === "object" ? genres : {}) };
    for (const type of types) {
      const catalog = library[type.id] || {};
      const known = new Set(Object.keys(catalog));
      if (!known.has(result[type.id])) result[type.id] = type.defaultGenre;
    }
    return result;
  }

  function projectTypeOptions(selectedType) {
    return types.map(({ id, label }) => `<option value="${id}"${id === selectedType ? " selected" : ""}>${label}</option>`).join("");
  }

  function genreOptions(typeId, selectedGenre) {
    const catalog = library[typeId] || {};
    const hidden = new Set(hiddenAliases[typeId] || []);
    const visibleSelection = hidden.has(selectedGenre) ? "sciencefiction" : selectedGenre;
    return Object.entries(catalog).filter(([id]) => !hidden.has(id)).map(([id, genre]) => `<option value="${id}"${id === visibleSelection ? " selected" : ""}>${genre.name}</option>`).join("");
  }

  function projectTypeLabel(typeId) {
    return types.find(({ id }) => id === typeId)?.label || "Project";
  }

  function genreLabel(typeId) {
    return typeId === "memoir" ? "Memoir structure" : "Genre / approach";
  }

  return { types, defaults, hiddenAliases, roleNames, rolePrompts, library, mergeIntoLibrary, mergeRolePrompts, initializeGenreChoices, projectTypeOptions, genreOptions, projectTypeLabel, genreLabel };
});
