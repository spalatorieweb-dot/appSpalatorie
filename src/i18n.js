export const i18n = {
  currentLang: localStorage.getItem('lang') || 'ro',
  
  dict: {
    ro: {
      "app_title": "Rezervări Spălătorie",
      "connecting": "Se conectează...",
      "retry": "Reîncearcă",
      "maintenance_title": "Mentenanță în Curs",
      "maintenance_desc1": "Revenim imediat! Facem curățenie în sistem.",
      "maintenance_desc2": "Ne vedem în câteva minute.",
      "im_admin": "Sunt Administrator",
      "online_reservations": "Rezervări Online",
      "made_by": "Made by Robert & Emi ",
      "new_reservation": "Rezervare nouă",

      "name_placeholder": "Ex: Maria Popescu",
      "secret_pin": "PIN (4 cifre)",
      "pin_placeholder": "Ex: 1234",
      "pin_helper": "Îl folosești ca să-ți ștergi rezervarea.",
      "opening_hours": "Program spălătorie:",
      "key_info": "Cheia se ia de la pază.",
      "privacy_desc1": "Se salvează doar numele, camera și intervalul rezervării.",
      "equipment": "Mașina",
      "machine1": "Mașina 1",
      "machine2": "Mașina 2",
      "date": "Data",
      "duration": "Durată",
      "start_time": "Ora de început",
      "book_now": "Rezervă",

      "schedule_24h": "Orar",
      "today": "Azi",
      "today_display": "Astăzi",

      "booking_details": "Rezervare",
      "delete": "Șterge",
      "confirmation": "Confirmare",
      "confirm_delete_msg": "Ești sigur că vrei să ștergi această rezervare?",
      "no_cancel": "Nu, renunț",
      "yes_delete": "Da, șterge",
      "delete_title": "Ștergere",
      "delete_pin_msg": "Introdu codul PIN (4 cifre) setat la rezervare:",
      "cancel": "Anulează",
      "admin": "Admin",
      "theme_dark": "Mod întunecat",
      "theme_light": "Mod luminos",
      "admin_email": "Email",
      "admin_password": "Parolă",
      "login": "Conectare",
      "admin_panel": "Panou admin",



      "maintenance": "Mentenanță",
      "system_online": "Sistem online",
      "system_offline": "Site oprit pentru studenți",
      "active": "Active",
      "history": "Istoric",




      "logout": "Deconectare",
      
      
      "connection_takes_long": "Conexiunea durează mult...",
      "new_day_calendar_updated": "Zi nouă! Calendarul s-a actualizat.",
      "busy": "Ocupat",
      "busy_remaining": "mai rămâne",

      "free": "Liber",
      "min": "min",


      "history_error": "Eroare la încărcare. Încearcă din nou.",
      "no_export_data": "Nu sunt date de exportat!",
      "cannot_see_past": "Nu poți vedea programul din trecut.",
      "select_time_err": "Te rog selectează ora!",
      "outside_hours_err": "Rezervările se pot face doar în programul spălătoriei:",
      "half_hour_err": "Ora de început trebuie să fie fixă sau și jumătate (ex: 10:00, 10:30).",
      "past_time_err": "Intervalul ales a trecut deja.",
      "admin_login_title": "Autentificare admin",
      "av_preview": "Previzualizare locală",
      "av_week_nav": "Alege săptămâna",
      "av_prev_week": "Săptămâna anterioară",
      "av_next_week": "Săptămâna următoare",
      "av_this_week": "Săptămâna curentă",
      "av_back": "Înapoi la site",
      "av_tab_grid": "Orar săptămână",
      "av_tab_list": "Listă rezervări",
      "av_search": "Caută nume sau cameră",
      "av_control": "Control",
      "av_by_day": "Ocupare pe zile",
      "av_by_person": "Intervale pe persoană",
      "av_tag_current": "Săptămâna curentă",
      "av_tag_next": "Săptămâna viitoare",
      "av_tag_last": "Săptămâna trecută",
      "av_tag_ago": "Acum {n} săptămâni",
      "av_kpi_bookings": "Rezervări",
      "av_kpi_bookings_sub": "{n} pe mașini",
      "av_kpi_slots": "Intervale ocupate",
      "av_kpi_occupied": "ocupare",
      "av_kpi_people": "Persoane",
      "av_kpi_busiest": "Cea mai plină zi",
      "av_empty_week": "Nicio rezervare în săptămâna asta.",
      "av_col_time": "Interval",
      "av_col_interval": "Interval",
      "av_col_day": "Ziua",
      "av_col_machines": "Mașini",
      "av_working": "Funcțională",
      "av_sheet_grid": "Orar",
      "av_sheet_list": "Rezervări",
      "av_generated": "Generat la",
      "av_export_done": "Raportul a fost descărcat.",
      "av_export_error": "Nu am putut genera fișierul Excel.",
      "slots": "Intervale",
      "slot_one": "1 interval",
      "slot_many": "{n} intervale",
      "slot_rule": "Fiecare persoană are {max} intervale de {min} min pe săptămână (luni–duminică).",
      "slots_left": "Mai ai {left} din {max} intervale",
      "slots_none_left": "Ai folosit toate cele {max} intervale",
      "weekly_limit_err": "Îți mai rămân doar {left} din {max} intervale săptămâna asta.",
      "how_to_book": "Apasă pe un interval liber din orar ca să rezervi.",
      "responsible": "Responsabili:",
      "machines_now": "Mașinile acum",
      "both_machines": "Ambele",
      "both_unavailable": "„Ambele” nu e disponibil: cealaltă mașină e ocupată sau defectă la ora asta.",
      "name": "Nume",
      "room": "Cameră",
      "room_err": "Scrie camera.",
      "from_time": "de la",

      "locked": "blocat",
      "prev_day": "Ziua anterioară",
      "next_day": "Ziua următoare",
      "week_days": "Zilele săptămânii",
      "close": "Închide",
      "week_locked_notice": "Săptămâna aceasta nu e deschisă încă. Rezervările se deschid",
      "week_locked_toast": "Săptămâna următoare se deschide",
      "choose_machine_err": "Alege o mașină!",
      "short_name_err": "Introdu un nume complet (minim 3 litere).",
      "pin_4_digits_err": "PIN-ul trebuie să aibă exact 4 cifre.",
      "slot_taken_err": "Intervalul este deja ocupat (verifica orarul).",

      "server_error": "Eroare server.",
      "verifying": "Verificare...",

      "reserved": "Rezervat:",
      "enter_4_pin_err": "Introdu PIN-ul de 4 cifre.",
      "booking_not_found_err": "Rezervarea nu a fost găsită.",
      "wrong_pin_err": "PIN Incorect!",
      "too_many_attempts_err": "Prea multe încercări greșite. Rezervarea e blocată 15 minute.",
      "error_generic": "A apărut o eroare.",
      "pdf_generating": "Se generează PDF...",
      "pdf_error": "Eroare la generarea PDF.",
      "loading": "Se încarcă...",
      "delete_success": "Rezervare ștearsă cu succes!",
      "permission_denied_err": "Eroare: Nu ai permisiunea de a șterge. Contactează un admin.",









      "enter_email_pass_err": "Introdu email și parolă",
      "logging_in": "Se conectează...",
      "login_success": "Autentificare reușită!",
      "login_err_default": "Email sau parolă greșită.",

      "login_err_wrong_pass": "Parolă incorectă.",

      "login_err_not_allowed": "Acest cont nu are drept de administrator.",
      "logout_success": "Deconectare reușită",
      "logout_error": "Eroare la deconectare",
      "maintenance_on": "Mentenanță ACTIVATĂ",
      "maintenance_off": "Mentenanță DEZACTIVATĂ",
      "no_bookings_search": "Nu am găsit rezervări conform căutării.",
      





      "broken": "Defect",
      "broken_on_toast": "Mașina a fost marcată ca DEFECTĂ.",
      "broken_off_toast": "Mașina este din nou FUNCȚIONALĂ.",
      "broken_toggle_on": "Marchează defectă",
      "broken_toggle_off": "Marchează reparată",

      "machine_broken_err": "Această mașină este momentan defectă. Alege alta.",




      "booking_confirmed": "Rezervare confirmată",
      "ok_close": "OK, Închide",

    },
    en: {
      "app_title": "Laundry Booking",
      "connecting": "Connecting...",
      "retry": "Retry",
      "maintenance_title": "Maintenance in Progress",
      "maintenance_desc1": "We'll be right back! Cleaning up the system.",
      "maintenance_desc2": "See you in a few minutes.",
      "im_admin": "I'm an Administrator",
      "online_reservations": "Online Reservations",
      "made_by": "Made by Robert & Emi",
      "new_reservation": "New booking",

      "name_placeholder": "E.g. Maria Popescu",
      "secret_pin": "PIN (4 digits)",
      "pin_placeholder": "Ex: 1234",
      "pin_helper": "You'll use it to delete your booking.",
      "opening_hours": "Laundry hours:",
      "key_info": "Pick up the key from the security desk.",
      "privacy_desc1": "Only your name, room and booking time are saved.",
      "equipment": "Machine",
      "machine1": "Washer 1",
      "machine2": "Washer 2",
      "date": "Date",
      "duration": "Duration",
      "start_time": "Start Time",
      "book_now": "Book",

      "schedule_24h": "Schedule",
      "today": "Today",
      "today_display": "Today",

      "booking_details": "Booking",
      "delete": "Delete",
      "confirmation": "Confirmation",
      "confirm_delete_msg": "Are you sure you want to delete this reservation?",
      "no_cancel": "No, cancel",
      "yes_delete": "Yes, delete",
      "delete_title": "Delete",
      "delete_pin_msg": "Enter the 4-digit PIN set during reservation:",
      "cancel": "Cancel",
      "admin": "Admin",
      "theme_dark": "Dark mode",
      "theme_light": "Light mode",
      "admin_email": "Email",
      "admin_password": "Password",
      "login": "Login",
      "admin_panel": "Admin panel",



      "maintenance": "Maintenance",
      "system_online": "System online",
      "system_offline": "Site closed",
      "active": "Active",
      "history": "History",




      "logout": "Logout",

      
      "connection_takes_long": "Connection is taking long...",
      "new_day_calendar_updated": "New day! Calendar has been updated.",
      "busy": "Busy",
      "busy_remaining": "remaining",

      "free": "Free",
      "min": "min",


      "history_error": "Error loading. Try again.",
      "no_export_data": "No data to export!",
      "cannot_see_past": "You cannot view past schedules.",
      "select_time_err": "Please select a time!",
      "outside_hours_err": "Bookings are only possible during laundry hours:",
      "half_hour_err": "Start time must be on the hour or half hour (e.g. 10:00, 10:30).",
      "past_time_err": "The selected slot is already over.",
      "admin_login_title": "Admin sign-in",
      "av_preview": "Local preview",
      "av_week_nav": "Choose week",
      "av_prev_week": "Previous week",
      "av_next_week": "Next week",
      "av_this_week": "This week",
      "av_back": "Back to site",
      "av_tab_grid": "Week schedule",
      "av_tab_list": "Booking list",
      "av_search": "Search name or room",
      "av_control": "Control",
      "av_by_day": "Load per day",
      "av_by_person": "Slots per person",
      "av_tag_current": "This week",
      "av_tag_next": "Next week",
      "av_tag_last": "Last week",
      "av_tag_ago": "{n} weeks ago",
      "av_kpi_bookings": "Bookings",
      "av_kpi_bookings_sub": "{n} machine bookings",
      "av_kpi_slots": "Slots used",
      "av_kpi_occupied": "occupied",
      "av_kpi_people": "People",
      "av_kpi_busiest": "Busiest day",
      "av_empty_week": "No bookings this week.",
      "av_col_time": "Slot",
      "av_col_interval": "Time",
      "av_col_day": "Day",
      "av_col_machines": "Machines",
      "av_working": "Working",
      "av_sheet_grid": "Schedule",
      "av_sheet_list": "Bookings",
      "av_generated": "Generated on",
      "av_export_done": "Report downloaded.",
      "av_export_error": "Could not generate the Excel file.",
      "slots": "Slots",
      "slot_one": "1 slot",
      "slot_many": "{n} slots",
      "slot_rule": "Everyone gets {max} slots of {min} min per week (Monday–Sunday).",
      "slots_left": "{left} of {max} slots left",
      "slots_none_left": "All {max} slots used",
      "weekly_limit_err": "You only have {left} of {max} slots left this week.",
      "how_to_book": "Tap a free slot in the schedule to book.",
      "responsible": "Responsible:",
      "machines_now": "Machines now",
      "both_machines": "Both",
      "both_unavailable": "“Both” isn't available: the other machine is busy or broken at this time.",
      "name": "Name",
      "room": "Room",
      "room_err": "Enter your room.",
      "from_time": "from",

      "locked": "locked",
      "prev_day": "Previous day",
      "next_day": "Next day",
      "week_days": "Days of the week",
      "close": "Close",
      "week_locked_notice": "This week is not open yet. Bookings open on",
      "week_locked_toast": "Next week opens on",
      "choose_machine_err": "Choose a machine!",
      "short_name_err": "Enter a full name (minimum 3 letters).",
      "pin_4_digits_err": "PIN must be exactly 4 digits.",
      "slot_taken_err": "The interval is already occupied (check schedule).",

      "server_error": "Server error.",
      "verifying": "Verifying...",

      "reserved": "Reserved:",
      "enter_4_pin_err": "Enter the 4-digit PIN.",
      "booking_not_found_err": "Reservation not found.",
      "wrong_pin_err": "Incorrect PIN!",
      "too_many_attempts_err": "Too many wrong attempts. This booking is locked for 15 minutes.",
      "error_generic": "An error occurred.",
      "pdf_generating": "Generating PDF...",
      "pdf_error": "Error generating PDF.",
      "loading": "Loading...",
      "delete_success": "Reservation successfully deleted!",
      "permission_denied_err": "Error: You do not have permission to delete. Contact an admin.",









      "enter_email_pass_err": "Enter email and password",
      "logging_in": "Logging in...",
      "login_success": "Login successful!",
      "login_err_default": "Incorrect email or password.",

      "login_err_wrong_pass": "Incorrect password.",

      "login_err_not_allowed": "This account is not an administrator.",
      "logout_success": "Logout successful",
      "logout_error": "Error logging out",
      "maintenance_on": "Maintenance ENABLED",
      "maintenance_off": "Maintenance DISABLED",
      "no_bookings_search": "No reservations found matching search.",





      "broken": "Broken",
      "broken_on_toast": "Machine marked as BROKEN.",
      "broken_off_toast": "Machine is FUNCTIONAL again.",
      "broken_toggle_on": "Mark broken",
      "broken_toggle_off": "Mark fixed",

      "machine_broken_err": "This machine is currently broken. Choose another.",




      "booking_confirmed": "Booking confirmed",
      "ok_close": "OK, Close",

    }
  },

  t(key) {
    return this.dict[this.currentLang][key] || key;
  },

  setLang(lang) {
    this.currentLang = lang;
    localStorage.setItem('lang', lang);
  }
};
