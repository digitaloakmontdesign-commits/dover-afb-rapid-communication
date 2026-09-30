/*
 * Demo library
 * Generic sample language for building and testing the framework.
 * NOT approved for release.
 *
 * Real 436 AW language belongs in content/local/, which git ignores,
 * or in a content pack loaded from a government share.
 * See docs/TEMPLATE-GUIDE.md.
 */
RCF.registerLibrary({
  id: 'demo',
  name: 'Demo library',
  version: '0.1.0',
  demo: true,
  office: '436th Airlift Wing Public Affairs',
  note: 'Sample language for development. Replace with approved 436 AW language before use.',

  // Every fact has an owner. The order here is the order of the inputs board.
  owners: {
    CC: 'Command',
    CP: 'Command Post',
    WX: 'Weather Flight',
    SF: 'Security Forces',
    CES: 'Civil Engineer',
    CPO: 'Civilian Personnel',
    MDG: 'Medical Group',
    FSS: 'Force Support',
    PA: 'Public Affairs'
  },

  categories: [
    { id: 'weather', name: 'Weather', summary: 'Delays, closures, early release and all clear' },
    { id: 'severe', name: 'Severe weather', summary: 'Tornado and severe storm warnings', tone: 'urgent' },
    { id: 'security', name: 'Security and access', summary: 'Gate closures and access changes' },
    { id: 'health', name: 'Public health', summary: 'Water and health advisories' },
    { id: 'media', name: 'Media response', summary: 'Holding statements and response to query' }
  ],

  fields: {
    // Command
    decision_authority: {
      label: 'Decision authority', owner: 'CC', type: 'text',
      suggestions: ['436 AW/CC', '436 AW/CV', '436 MSG/CC'],
      help: 'Who made the call. Appears in internal products and the event record.'
    },

    // Command Post
    effective_date: { label: 'Effective date', owner: 'CP', type: 'date' },
    effective_time: { label: 'Effective time', owner: 'CP', type: 'time' },
    report_time: { label: 'Report time', owner: 'CP', type: 'time', help: 'When the people below report.' },
    release_time: { label: 'Release time', owner: 'CP', type: 'time' },
    closed_until: { label: 'Closure end time', owner: 'CP', type: 'time', help: 'Leave blank if no end time is set yet.' },
    resume_time: { label: 'Resume time', owner: 'CP', type: 'time' },
    affected: {
      label: 'Affected personnel', owner: 'CP', type: 'multiselect',
      options: ['non-mission-essential personnel', 'military members', 'civilian employees', 'contractors', 'all personnel']
    },
    mission_essential: {
      label: 'Mission-essential guidance', owner: 'CP', type: 'textarea',
      standard: 'Mission-essential personnel should report as scheduled unless their supervisors direct otherwise.'
    },
    shelter_guidance: {
      label: 'Protective action', owner: 'CP', type: 'textarea',
      standard: 'Move to an interior room on the lowest floor of a sturdy building, away from windows. Stay there until the warning expires or an all clear is given.'
    },

    // Weather Flight
    hazard: {
      label: 'Hazard', owner: 'WX', type: 'text',
      suggestions: ['winter weather', 'snow and ice', 'icy road conditions', 'flooding', 'high winds', 'severe thunderstorms', 'extreme cold'],
      help: 'Write it to finish the phrase "due to...", in lowercase.'
    },
    warning_source: {
      label: 'Warning source', owner: 'WX', type: 'text',
      suggestions: ['the National Weather Service', 'the base weather flight']
    },
    warning_area: { label: 'Warning area', owner: 'WX', type: 'text', suggestions: ['Kent County', 'Dover Air Force Base'] },
    warning_expires: { label: 'Warning expires', owner: 'WX', type: 'time' },

    // Security Forces
    gate_status: {
      label: 'Gate status', owner: 'SF', type: 'text',
      suggestions: ['All gates are operating on normal hours.'],
      help: 'Hours and any closures, as confirmed by Security Forces.'
    },
    gate_name: { label: 'Gate', owner: 'SF', type: 'text', help: 'Name only, for example: Main Gate.' },
    gate_reason: { label: 'Releasable reason', owner: 'SF', type: 'text', help: 'Only what SF and PA have cleared. Leave blank to omit.' },
    alternate_route: { label: 'Alternate gate or route', owner: 'SF', type: 'text', help: 'For example: the North Gate.' },
    expected_reopen: { label: 'Reopening time', owner: 'SF', type: 'time' },
    incident_date: { label: 'Incident date', owner: 'SF', type: 'date' },
    incident_time: { label: 'Incident time', owner: 'SF', type: 'time' },
    incident_summary: {
      label: 'Incident summary', owner: 'SF', type: 'textarea',
      help: 'Releasable facts only. Finish the sentence "At approximately 0930 Tuesday, ..."'
    },
    responder_status: { label: 'Responder status', owner: 'SF', type: 'text', suggestions: ['Emergency responders are on scene.'] },
    investigation_status: { label: 'Investigation', owner: 'SF', type: 'text', standard: 'The incident is under investigation.' },

    // Civil Engineer
    road_conditions: { label: 'Base road conditions', owner: 'CES', type: 'text', suggestions: ['Crews are treating base roads. Drive with caution.'] },
    state_restrictions: {
      label: 'State and local restrictions', owner: 'CES', type: 'text',
      help: 'Delaware or Kent County restrictions in effect, as confirmed by Emergency Management.'
    },
    water_area: { label: 'Affected area', owner: 'CES', type: 'text', help: 'For example: base housing, or all facilities on the installation.' },
    response_actions: { label: 'Repair status', owner: 'CES', type: 'text' },

    // Civilian Personnel
    civilian_guidance: {
      label: 'Civilian employee guidance', owner: 'CPO', type: 'textarea',
      standard: 'Civilian employees should contact their supervisors for leave and telework guidance.'
    },

    // Medical Group
    clinic_status: { label: 'Clinic status', owner: 'MDG', type: 'text', help: 'Clinic and pharmacy hours or closures.' },
    water_action: {
      label: 'Protective action', owner: 'MDG', type: 'textarea',
      help: 'Protective action from Bioenvironmental Engineering, for example boil water, do not drink or do not use.'
    },
    health_guidance: { label: 'Health guidance', owner: 'MDG', type: 'textarea' },
    injury_status: { label: 'Injuries', owner: 'MDG', type: 'text', help: 'Only what MDG has cleared for release.' },

    // Force Support
    cdc_status: { label: 'Child and youth programs', owner: 'FSS', type: 'text', help: 'Child Development Center and youth programs status.' },
    water_alternative: { label: 'Alternate water source', owner: 'FSS', type: 'text' },

    // Public Affairs
    next_update_time: { label: 'Next update time', owner: 'PA', type: 'time' },
    update_channels: { label: 'Update channel', owner: 'PA', type: 'text', standard: 'the official Dover Air Force Base Facebook page' },
    nok_statement: {
      label: 'Next of kin', owner: 'PA', type: 'text',
      standard: 'Names of those involved will not be released until 24 hours after next of kin have been notified.'
    },
    pa_contact: { label: 'Media contact', owner: 'PA', type: 'text', help: 'Phone number or email for media queries.' }
  },

  templates: [
    /* ---------------------------------------------------------------- */
    {
      id: 'weather-delay',
      category: 'weather',
      title: 'Delayed reporting',
      summary: 'Weather pushes the report time back for some or all personnel.',
      approval: '436 AW/CC or designee',
      required: ['decision_authority', 'hazard', 'effective_date', 'report_time', 'affected', 'mission_essential', 'civilian_guidance', 'gate_status', 'next_update_time'],
      optional: ['road_conditions', 'state_restrictions', 'cdc_status', 'clinic_status', 'update_channels'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: Delayed reporting {{effective_date|apday}} due to {{hazard}}. {{affected|list|cap}} report at {{report_time}}. Check with your supervisor.'
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `WEATHER UPDATE: Due to {{hazard}}, Dover Air Force Base will operate on a delayed reporting schedule {{effective_date|apday}}.

{{affected|list|cap}} should report at {{report_time}}.

{{mission_essential|sentence}}

{{civilian_guidance|sentence}}

Gates: {{gate_status|sentence}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if state_restrictions}}State and local: {{state_restrictions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

Please use caution when traveling. The next update will be posted by {{next_update_time}}{{#if update_channels}} on {{update_channels}}{{/if}}.`
        },
        {
          id: 'email', label: 'Base-wide email', audience: 'internal',
          text: `Subject: Delayed reporting, {{effective_date|mil}}

Team Dover,

Due to {{hazard}}, the installation will operate on a delayed reporting schedule on {{effective_date|mil}}. {{affected|list|cap}} will report at {{report_time|mil}}.

{{mission_essential|sentence}}

{{civilian_guidance|sentence}}

Gates: {{gate_status|sentence}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if state_restrictions}}State and local: {{state_restrictions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

Supervisors: please relay this guidance to personnel without email access.

The next update will be issued by {{next_update_time|mil}}.

This guidance is issued at the direction of {{decision_authority}}.
436th Airlift Wing Public Affairs`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'weather-closure',
      category: 'weather',
      title: 'Installation closure',
      summary: 'Base closed to all but mission-essential personnel.',
      approval: '436 AW/CC',
      required: ['decision_authority', 'hazard', 'effective_date', 'mission_essential', 'civilian_guidance', 'gate_status', 'next_update_time'],
      optional: ['closed_until', 'road_conditions', 'state_restrictions', 'cdc_status', 'clinic_status', 'update_channels'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: Base closed to all but mission-essential personnel {{effective_date|apday}}{{#if closed_until}} until {{closed_until}}{{/if}} due to {{hazard}}. Check with your supervisor.'
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `WEATHER CLOSURE: Due to {{hazard}}, Dover Air Force Base is closed to all but mission-essential personnel {{effective_date|apday}}{{#if closed_until}} until {{closed_until}}{{/if}}.

{{mission_essential|sentence}}

{{civilian_guidance|sentence}}

Gates: {{gate_status|sentence}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if state_restrictions}}State and local: {{state_restrictions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

Please avoid unnecessary travel. The next update will be posted by {{next_update_time}}{{#if update_channels}} on {{update_channels}}{{/if}}.`
        },
        {
          id: 'email', label: 'Base-wide email', audience: 'internal',
          text: `Subject: Installation closure, {{effective_date|mil}}

Team Dover,

Due to {{hazard}}, the installation is closed to all but mission-essential personnel on {{effective_date|mil}}{{#if closed_until}} until {{closed_until|mil}}{{/if}}.

{{mission_essential|sentence}}

{{civilian_guidance|sentence}}

Gates: {{gate_status|sentence}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if state_restrictions}}State and local: {{state_restrictions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

Supervisors: please relay this guidance to personnel without email access.

The next update will be issued by {{next_update_time|mil}}.

This guidance is issued at the direction of {{decision_authority}}.
436th Airlift Wing Public Affairs`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'weather-early-release',
      category: 'weather',
      title: 'Early release',
      summary: 'Personnel released early ahead of or during hazardous weather.',
      approval: '436 AW/CC or designee',
      required: ['decision_authority', 'hazard', 'effective_date', 'release_time', 'affected', 'mission_essential', 'civilian_guidance', 'next_update_time'],
      optional: ['gate_status', 'road_conditions', 'state_restrictions', 'cdc_status', 'clinic_status', 'update_channels'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: Early release {{effective_date|apday}} due to {{hazard}}. {{affected|list|cap}} released at {{release_time}}. Check with your supervisor.'
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `EARLY RELEASE: Due to {{hazard}}, {{affected|list}} at Dover Air Force Base will be released at {{release_time}} {{effective_date|apday}}.

{{mission_essential|sentence}}

{{civilian_guidance|sentence}}

{{#if gate_status}}Gates: {{gate_status|sentence}}{{/if}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if state_restrictions}}State and local: {{state_restrictions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

Please use caution on the roads. The next update will be posted by {{next_update_time}}{{#if update_channels}} on {{update_channels}}{{/if}}.`
        },
        {
          id: 'email', label: 'Base-wide email', audience: 'internal',
          text: `Subject: Early release, {{effective_date|mil}}

Team Dover,

Due to {{hazard}}, {{affected|list}} will be released at {{release_time|mil}} on {{effective_date|mil}}.

{{mission_essential|sentence}}

{{civilian_guidance|sentence}}

{{#if gate_status}}Gates: {{gate_status|sentence}}{{/if}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if state_restrictions}}State and local: {{state_restrictions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

The next update will be issued by {{next_update_time|mil}}.

This guidance is issued at the direction of {{decision_authority}}.
436th Airlift Wing Public Affairs`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'weather-all-clear',
      category: 'weather',
      title: 'Normal operations resume',
      summary: 'All clear after a weather delay or closure.',
      approval: '436 AW/CC or designee',
      required: ['decision_authority', 'effective_date', 'resume_time'],
      optional: ['gate_status', 'road_conditions', 'cdc_status', 'clinic_status'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: Normal operations resume at {{resume_time}} {{effective_date|apday}}. Use caution on the roads.'
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `ALL CLEAR: Dover Air Force Base will resume normal operations at {{resume_time}} {{effective_date|apday}}.

{{#if gate_status}}Gates: {{gate_status|sentence}}{{/if}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

Thank you for your patience, Team Dover.`
        },
        {
          id: 'email', label: 'Base-wide email', audience: 'internal',
          text: `Subject: Normal operations resume, {{effective_date|mil}}

Team Dover,

The installation will resume normal operations at {{resume_time|mil}} on {{effective_date|mil}}.

{{#if gate_status}}Gates: {{gate_status|sentence}}{{/if}}
{{#if road_conditions}}Roads: {{road_conditions|sentence}}{{/if}}
{{#if cdc_status}}Child and youth programs: {{cdc_status|sentence}}{{/if}}
{{#if clinic_status}}Clinic: {{clinic_status|sentence}}{{/if}}

This guidance is issued at the direction of {{decision_authority}}.
436th Airlift Wing Public Affairs`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'severe-tornado-warning',
      category: 'severe',
      title: 'Tornado warning',
      summary: 'Take-shelter message while a tornado warning is in effect.',
      approval: 'Per the installation emergency management plan',
      required: ['warning_source', 'warning_area', 'warning_expires', 'shelter_guidance'],
      optional: ['update_channels'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: TORNADO WARNING for {{warning_area}} until {{warning_expires}}. Take shelter now: interior room, lowest floor, away from windows.'
        },
        {
          id: 'voice', label: 'Giant Voice script', audience: 'internal',
          text: `Attention, attention. {{warning_source|cap}} has issued a tornado warning for {{warning_area}} until {{warning_expires}}. Take shelter immediately. {{shelter_guidance|sentence}}

I say again: a tornado warning is in effect for {{warning_area}} until {{warning_expires}}. Take shelter immediately.`
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `TORNADO WARNING: {{warning_source|cap}} has issued a tornado warning for {{warning_area}} until {{warning_expires}}.

Take shelter now. {{shelter_guidance|sentence}}

We will post an all clear when it is safe{{#if update_channels}} on {{update_channels}}{{/if}}.`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'security-gate-closure',
      category: 'security',
      title: 'Gate closure',
      summary: 'A gate closes or changes hours and traffic reroutes.',
      approval: '436 MSG/CC or designee',
      required: ['gate_name', 'effective_date', 'effective_time', 'alternate_route'],
      optional: ['gate_reason', 'expected_reopen', 'update_channels'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: The {{gate_name}} is closed{{#if gate_reason}} due to {{gate_reason}}{{/if}}. Use {{alternate_route}}. Expect delays.'
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `GATE UPDATE: The {{gate_name}} at Dover Air Force Base is closed{{#if gate_reason}} due to {{gate_reason}}{{/if}}, effective {{effective_time}} {{effective_date|apday}}.

Personnel and visitors should use {{alternate_route}}. Please expect delays and follow the directions of Security Forces personnel.

{{#if expected_reopen}}The gate is expected to reopen at {{expected_reopen}}.{{else}}We will post an update when the gate reopens{{#if update_channels}} on {{update_channels}}{{/if}}.{{/if}}`
        },
        {
          id: 'email', label: 'Base-wide email', audience: 'internal',
          text: `Subject: {{gate_name}} closure, {{effective_date|mil}}

Team Dover,

The {{gate_name}} is closed{{#if gate_reason}} due to {{gate_reason}}{{/if}}, effective {{effective_time|mil}} on {{effective_date|mil}}. Use {{alternate_route}} and plan for additional travel time.

{{#if expected_reopen}}The gate is expected to reopen at {{expected_reopen|mil}}.{{else}}An update will follow when the gate reopens.{{/if}}

436th Airlift Wing Public Affairs`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'health-water-advisory',
      category: 'health',
      title: 'Drinking water advisory',
      summary: 'Water advisory for part or all of the installation.',
      approval: '436 AW/CC or designee',
      required: ['water_area', 'water_action', 'effective_date', 'effective_time', 'next_update_time'],
      optional: ['water_alternative', 'response_actions', 'health_guidance', 'update_channels'],
      products: [
        {
          id: 'alert', label: 'Mass notification', audience: 'internal', limit: 160,
          text: 'DOVER AFB: Drinking water advisory for {{water_area}}. {{water_action|sentence}}'
        },
        {
          id: 'social', label: 'Social media', audience: 'public',
          text: `WATER ADVISORY: A drinking water advisory is in effect for {{water_area}} at Dover Air Force Base, effective {{effective_time}} {{effective_date|apday}}.

{{water_action|sentence}}

{{#if water_alternative}}{{water_alternative|sentence}}{{/if}}

{{#if response_actions}}{{response_actions|sentence}}{{/if}}

{{#if health_guidance}}{{health_guidance|sentence}}{{/if}}

The next update will be posted by {{next_update_time}}{{#if update_channels}} on {{update_channels}}{{/if}}.`
        },
        {
          id: 'email', label: 'Base-wide email', audience: 'internal',
          text: `Subject: Drinking water advisory, {{water_area}}

Team Dover,

A drinking water advisory is in effect for {{water_area}}, effective {{effective_time|mil}} on {{effective_date|mil}}.

{{water_action|sentence}}

{{#if water_alternative}}Alternate water: {{water_alternative|sentence}}{{/if}}
{{#if response_actions}}Repairs: {{response_actions|sentence}}{{/if}}
{{#if health_guidance}}Health: {{health_guidance|sentence}}{{/if}}

The next update will be issued by {{next_update_time|mil}}.

436th Airlift Wing Public Affairs`
        }
      ]
    },

    /* ---------------------------------------------------------------- */
    {
      id: 'media-holding-statement',
      category: 'media',
      title: 'Incident holding statement',
      summary: 'Statement for media queries while facts develop.',
      posture: 'rtq',
      approval: '436 AW/CC or designee',
      required: ['incident_date', 'incident_time', 'incident_summary', 'pa_contact'],
      optional: ['responder_status', 'injury_status', 'investigation_status', 'nok_statement'],
      products: [
        {
          id: 'media', label: 'Holding statement', audience: 'public',
          text: `At approximately {{incident_time}} {{incident_date|apday}}, {{incident_summary|sentence}}

{{#if responder_status}}{{responder_status|sentence}} {{/if}}{{#if injury_status}}{{injury_status|sentence}} {{/if}}{{#if investigation_status}}{{investigation_status|sentence}}{{/if}}

Additional information will be released as it becomes available.

{{#if nok_statement}}{{nok_statement|sentence}}{{/if}}

Media inquiries: 436th Airlift Wing Public Affairs, {{pa_contact}}`
        },
        {
          id: 'points', label: 'Talking points', audience: 'internal',
          text: `- At approximately {{incident_time}} {{incident_date|apday}}, {{incident_summary|sentence}}
{{#if responder_status}}- {{responder_status|sentence}}{{/if}}
{{#if injury_status}}- {{injury_status|sentence}}{{/if}}
{{#if investigation_status}}- {{investigation_status|sentence}}{{/if}}
- We will release more information as it becomes available.
{{#if nok_statement}}- {{nok_statement|sentence}}{{/if}}

Stay inside these points. Do not speculate on cause, names or numbers.`
        }
      ]
    }
  ]
});
