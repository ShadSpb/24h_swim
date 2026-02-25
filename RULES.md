General description:
Site used to track swimming activities during swimming competitions.
It's mainly dedicated for 24 hours swimming event.

Competition Limitations:
1. Each team can have only one swimmer swimming at the same moment of time on any line.
2. Each swimmer can swim only on the line where his/her team was registered. Change of line is not possible or done by organizer of the competition.
3. Teams may have colors assigned according to color of the hat used to swim.
3.1 Same color on the single swimming line - NOT possible.
3.2 Same color on the different swimming lines - possible.

Competition Algorithm:
1. Before start each team must be registered on the line where they're swimming. This can be done by organizer in advance.
2. Before diving into the water, every swimmer register himself with the referee on the assigned line.
3. After diving into the water, referee counts number of appearances of swimmer (team) on the count side.
4. Once swimming completed, swimmer goes out of the water and unregister himself on the line where he was swimming.

6. Every referee can unregister himself at any moment of time.
6.1 There can NOT be a case that no referees registered on the swimming line where people are still swimming.

7. Every swimmer can unregister himself at any moment of time.
7.1 There can be a case that no swimmers from the single team or all assigned teams are in the water.
7.1 There can NOT be a case that 2 swimmers from the same team are in water (general limitation).

Used entities:
- Organizer: create teams, referees, swimmers, lines, competition
- Team: contain swimmers. Each team can specific color assigned (per line) or have logo.
- Referees: contain list of referees
- Swimmers: contain list of swimmers that belong to team
- Swimming lines: match between referees, swimmers, teams.
- Counter (calculated value): number of lines that referee counted per swimmer / team
- Monitor user: used to show swimmer statistics, access by specific link (competition id?) accessible to everyone by link.

Final goals:
- Count number of lines that one swimmer did.
- Count number of lines that one team did.
- Show result in a real time.
- Provide continuity for calculation.
- Provide smooth interface for referees.

UI considerations for website content:
- Swimmers which are below 12 year old must have a parent contact defined. Under contact, there must be parent name.
- Swimmers which are below 12 year old must have parent present during their swimming.
(During specific time e.g between 22:00 and 04:00 / All times)
- Web pages must be provided in 2 languages: English and German. Main language must be German.
- There should be no "rights reservation" banner in the footer.

Technical considerations for website:
- Web site must be mobile / tablet friendly.
- All pages and activity must be server generated. No logic can be pushed down / provided to the end client.
- Authorization logic managed and controlled from the frontend side. Authentication logic can be configured from the "admin" webpage by selectin one of 2 types: 1) Built in - internal logic from the frontend 2) External by API - external logic where website sents login and password for backend to verify that user can logon. External API may return OK, NOK with the user role (organizer, referee) and list of assigned competitions.
- Additionaly, backend API allow to work with data, register information about swimmers, get information about swimmers and count every lap same as request information for statistics. Access done via API, swagger documentation is available (Request me back if need).

Website considerations:
Page structure:
- Main page:
    - About competition
    - Rules / FAQ
    - Datenshutz / Private data protection
    - Login Zone / Registration
    
- Authenticated page:
    - Organizer page
    - Referee page
    - Monitor page
    - Admin page

- There must be a landing page with main description of the competition and links to "About" pages, competition rules, Possibility to register / logon.
- There must be registration and logon page for new users (competition organizers).
- Each organizer register himself, create competition which has a date, time, location, number of lines used in the competition, length of the line, timeout period to avoid double count, list of referees, list of the teams, team members. 
    - Every team might have specific color assigned. Team members belong to teams. Must have possibility to be marked as below 12 years old. (Organizer page)
- Organizer must have an competition status control, for the case if it needs to be started earlier or later in time.
- Organizer of the competition can stop competition earlier in case if this is necessary. Closure can not be done without double confirmation by providing email of the organizer, competition name and checkbox that competition can be closed NOW.
- Overall competition control may contain 3 switches: Start, Finish, Pause, Force Stop.
- Once competition finished or stopped or on pause, there should be no more lines counting, even if swimmers are still in the water.
- Counting of the laps must be prevented in the case if competition not started.
- There must be possibility to edit each and every entity created by the organizer only by organizer. (There must be basic authorizations checks.)
    - Consider limitations of the competition and take into account organizer's possibilities to change data.
- Competitions are not allowed to be created in the past by organizers.
- Each referee is registered by organizer, system must provide simple user id with password (User id in format ref_% where % can be any random number up to 100000). Password must be shown on the screen. Mainly password must be human friendly but randomly generated.
- Organizer must have possibility to reset password of the referee at any time. After reset previous session of referee must be ended and logout completed.
- New password can be send by email in case if email was provided or shown on the screen if it was autogenerated uid.
- Each referee can logon with his username and password and see his assigned competitions. Note that the referee can be assigned to different competitions by the same or different organizers.
- Referee can count on any lane.
- Referees and organizers must see information about: which referee registered on which line, how many teams now registered on the line, how many swimmers (overall) must swim on the line now.
- There must be interface for referee to count number of lines that swimmer or swimmers from different teams on the same line made. (Referee page)
- To count lines that swimmer completed, referee can press button with the team name or team color or team logo. There should be a clear interface that would avoid misunderstanding. There must be check that 2 refereees assigned into the same swimming line are not pressing the button (there should be no principle of double counting).
- There can be different teams on the same lane, so referee must be able to count lap for every team which is now in the water.
- For the swimmers there must be no logon possibility however each referee must have a possibility to register swimmer or several swimmers from different teams on the swimming line during competition. At the end of the swimming each swimmer can be unregistered by the referee of the line where he was swimming.
- Once swimmer registered, it can start swim and referee can start to count number of completed swimming lines. Non-registered swimmers can not swim, see competition limitations.
- There must be a monitor page available showing current status of the competition, in particular:
    - Table of the teams sorted by the number of lines (distance) that every team completed. Sorted in descending order, team with the most number completed lines must be on the top.
    - Time when competition started and when it will be completed with the countdown.
    - Basic speed statistics, like number of lines per hour, fastest distance marked (time between 2 counts).
    - Two additional columns with the times, of how many lines were counted between midnight and 1AM and between 5AM and 6AM. Categories are called late bird and early bird.
- Monitor must be accessible by unique site link that can be shared. Anonymous access must be available.

- In the about page, it's necessary to mention that this is a social project and there's no obligatory to pay for usage of the service. However creator asks to use service with respect. There's also no control on consistency of the data. And the whole service provided As Is without any warranty or responsibility.

- In the Datenshutz / Private data protection page => Must contain typical information for the Germany based / hosted web sites.

- By the end of competition, server must send generated pdf document with result of competition.

- Admin page must contain following:
    - Configuration of SMTP service to send email notifications.
        - Types of the email notifications:
            - Organizer registration completeness
            - Password reset for organizer.
            - Password reset for referee (if email was provided)
            - Result of competition after its end.
            - Feedback / Question out of FAQ page
    - Address of the backend service.
    - Type of the authentication mechanism (built-in / external via backend API)
    - Number of the currently active (logged on) users with split on types: referees / organizers.
    - Number of planned and completed competitions.
    - Maintenance button that disable access to all pages and notify user that the website is under maintenance.
    (Maintenance page still must provide possibility to admin user for logon.)
- Admin page must be accessible by the username / password: admin / admin
- Admin page must have possibility to change password of the admin user.
- Admin page should not access to the data of swimmers / referees / organizers anyhow.

- Under FAQ Page, prepare template with Generic question and answer in expanding format. This will be later adjusted manually