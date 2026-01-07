Limitations:
1. Each referee (schwimmbahn rechner) can be registered only on a single swimming line. One referee can not control swimmers on 2 different lines.
=> Correction 1:
It can happen that the referee is controlling two lanes during different times (e.g. lane 1 from 6-7 and lane 2 from 9-10). At 3am in the morning we even had the case that 1 referee was controlling 2 lanes as only 2-3 swimmers on both lanes.

2. Each team can have only one swimmer swimming at the same moment of time on any line.
2.1 Even if swimmer not in the water. Only single swimmer approved.
3. Each swimmer can swim only on the line where his/her team was registered. Change of line is not possible or done by organizer.
4. Double count in a short period must be blocked. Short period = 10s (to be discussed)
5. Teams may have colors assigned.
5.1 Same color on the single swimming line - NOT possible.
5.2 Same color on the different swimming lines - possible.

Rules:
1. Before start each referee must be registered on the swimming line where he's going to control swimmers. This can be done by organizer in advance.
2. Before start each team must be registered on the line where they're swimming. This can be done by organizer in advance.
3. Before diving into the water, every swimmer register himself with the referee on the assigned line.
4. After diving into the water, referee counts number of appearances of swimmer (team) on the count side.
4.1 Each count means 2 lines since the referee seats only on the single side.
5. Once swimming completed, swimmer goes out of the water and unregister himself on the line where he was swimming.

6. Every referee can unregister himself at any moment of time.
6.1 There can NOT be a case that no referees registered on the swimming line where people are still swimming.

7. Every swimmer can unregister himself at any moment of time.
7.1 There can be a case that no swimmers from the team / all assigned teams are in the water.
7.1 There can NOT be a case that 2 swimmers from the same team are in water (general limitation)

Used entities:
- Organizer: create teams, referees, swimmers, lines, competition.
- Team: contain swimmers. Each team can specific color assigned (per line)
- Referees: contain list of referees
- Swimmers: contain list of swimmers that belong to team
- Lines to swim: match between referees, swimmers, teams.
- Counter (calculated value): number of lines that referee counted per swimmer / team

Final goals:
- Count number of lines that one swimmer did.
- Count number of lines that one team did.
- Show result in a real time.
- Provide continuity for calculation.
- Provide smooth interface for referees.

UI considerations:
- Swimmers which are below 12 year old must have a parent contact defined.
- Swimmers which are below 12 year old must have parent present during their swimming.
(During specific time e.g between 22:00 and 04:00 / All times)
