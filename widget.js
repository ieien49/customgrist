// Configuration Grist API
const DOC_ID = 'TON_ID_DE_DOCUMENT_GRIST';
const API_KEY = 'TON_API_KEY_GRIST';
const BASE_URL = `https://api.getgrist.com/api/docs/${DOC_ID}`;

// Composant principal
class GristCalendar extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      events: [],
      teams: [],
      selectedEvent: null,
      showEventForm: false,
      formData: { objet: '', debut: '', fin: '', equipe: '' },
      formMode: 'create',
    };
    this.calendarRef = React.createRef();
  }

  async componentDidMount() {
    await this.fetchTeams();
    await this.fetchEvents();
    this.initCalendar();
  }

  // Récupère la liste des équipes depuis Grist
  async fetchTeams() {
    try {
      const response = await axios.get(`${BASE_URL}/tables/EQUIPES/records`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });
      this.setState({ teams: response.data });
    } catch (error) {
      console.error("Erreur lors de la récupération des équipes:", error);
    }
  }

  // Récupère les réservations depuis Grist
  async fetchEvents() {
    try {
      const response = await axios.get(`${BASE_URL}/tables/RESERVATIONS/records`, {
        headers: { Authorization: `Bearer ${API_KEY}` }
      });
      const events = response.data.map(r => ({
        id: r.id,
        title: r.fields.objet,
        start: r.fields.debut,
        end: r.fields.fin,
        color: this.getTeamColor(r.fields.equipe),
        extendedProps: { equipeId: r.fields.equipe }
      }));
      this.setState({ events });
    } catch (error) {
      console.error("Erreur lors de la récupération des événements:", error);
    }
  }

  // Retourne la couleur de l'équipe
  getTeamColor(teamId) {
    const team = this.state.teams.find(t => t.id === teamId);
    return team ? team.fields.couleur : '#cccccc';
  }

  // Initialise le calendrier FullCalendar
  initCalendar() {
    const calendarEl = this.calendarRef.current;
    this.calendar = new FullCalendar.Calendar(calendarEl, {
      locale: 'fr',
      initialView: 'timeGridWeek',
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: ''
      },
      slotMinTime: '08:00:00',
      slotMaxTime: '19:00:00',
      allDaySlot: false,
      weekends: false,
      events: this.state.events,
      eventDidMount: (info) => {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'fc-event-resizer';
        info.el.appendChild(resizeHandle);
      },
      eventDrop: this.handleEventDrop.bind(this),
      eventResize: this.handleEventResize.bind(this),
      dateClick: this.handleDateClick.bind(this),
      eventClick: this.handleEventClick.bind(this),
      eventClassNames: () => ['custom-event'],
    });
    this.calendar.render();
  }

  // Gestion du déplacement d'un événement
  async handleEventDrop(info) {
    const { event } = info;
    try {
      await axios.patch(
        `${BASE_URL}/tables/RESERVATIONS/records/${event.id}`,
        {
          debut: event.start.toISOString(),
          fin: event.end ? event.end.toISOString() : event.start.toISOString(),
        },
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'événement:", error);
      info.revert();
    }
  }

  // Gestion du redimensionnement d'un événement
  async handleEventResize(info) {
    const { event } = info;
    try {
      await axios.patch(
        `${BASE_URL}/tables/RESERVATIONS/records/${event.id}`,
        { fin: event.end.toISOString() },
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );
    } catch (error) {
      console.error("Erreur lors de la mise à jour de l'événement:", error);
      info.revert();
    }
  }

  // Gestion du clic sur une date (création)
  handleDateClick(info) {
    this.setState({
      showEventForm: true,
      formMode: 'create',
      formData: {
        objet: '',
        debut: info.dateStr,
        fin: new Date(new Date(info.dateStr).getTime() + 3600000).toISOString(),
        equipe: '',
      }
    });
  }

  // Gestion du clic sur un événement (modification/suppression)
  handleEventClick(info) {
    const event = info.event;
    this.setState({
      showEventForm: true,
      formMode: 'edit',
      formData: {
        id: event.id,
        objet: event.title,
        debut: event.start.toISOString(),
        fin: event.end.toISOString(),
        equipe: event.extendedProps.equipeId,
      }
    });
    info.jsEvent.preventDefault();
  }

  // Fermeture du formulaire
  closeForm() {
    this.setState({ showEventForm: false });
  }

  // Soumission du formulaire
  async handleSubmit(e) {
    e.preventDefault();
    const { formData, formMode } = this.state;
    try {
      if (formMode === 'create') {
        await axios.post(
          `${BASE_URL}/tables/RESERVATIONS/records`,
          {
            objet: formData.objet,
            debut: formData.debut,
            fin: formData.fin,
            equipe: formData.equipe,
          },
          { headers: { Authorization: `Bearer ${API_KEY}` } }
        );
      } else {
        await axios.patch(
          `${BASE_URL}/tables/RESERVATIONS/records/${formData.id}`,
          {
            objet: formData.objet,
            debut: formData.debut,
            fin: formData.fin,
            equipe: formData.equipe,
          },
          { headers: { Authorization: `Bearer ${API_KEY}` } }
        );
      }
      await this.fetchEvents();
      this.calendar.refetchEvents();
      this.closeForm();
    } catch (error) {
      console.error("Erreur lors de la sauvegarde:", error);
    }
  }

  // Suppression d'un événement
  async handleDelete() {
    const { formData } = this.state;
    try {
      await axios.delete(
        `${BASE_URL}/tables/RESERVATIONS/records/${formData.id}`,
        { headers: { Authorization: `Bearer ${API_KEY}` } }
      );
      await this.fetchEvents();
      this.calendar.refetchEvents();
      this.closeForm();
    } catch (error) {
      console.error("Erreur lors de la suppression:", error);
    }
  }

  // Mise à jour du formulaire
  handleChange(e) {
    const { name, value } = e.target;
    this.setState(prev => ({
      formData: { ...prev.formData, [name]: value }
    }));
  }

  render() {
    const { showEventForm, formData, formMode, teams } = this.state;
    return (
      <div>
        <div ref={this.calendarRef} style={{ height: '100vh' }}></div>
        {showEventForm && (
          <div className="fc-popover" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, width: 300 }}>
            <div className="fc-popover-header">
              <h3>{formMode === 'create' ? 'Nouvelle réunion' : 'Modifier la réunion'}</h3>
            </div>
            <div className="fc-popover-body">
              <form onSubmit={this.handleSubmit.bind(this)}>
                <div className="form-group">
                  <label>Objet</label>
                  <input type="text" name="objet" value={formData.objet} onChange={this.handleChange.bind(this)} required />
                </div>
                <div className="form-group">
                  <label>Début</label>
                  <input type="datetime-local" name="debut" value={formData.debut.replace('Z', '').slice(0, 16)} onChange={this.handleChange.bind(this)} required />
                </div>
                <div className="form-group">
                  <label>Fin</label>
                  <input type="datetime-local" name="fin" value={formData.fin.replace('Z', '').slice(0, 16)} onChange={this.handleChange.bind(this)} required />
                </div>
                <div className="form-group">
                  <label>Équipe</label>
                  <select name="equipe" value={formData.equipe} onChange={this.handleChange.bind(this)} required>
                    <option value="">-- Sélectionner --</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.fields.nom}</option>
                    ))}
                  </select>
                </div>
                <div className="form-actions">
                  {formMode === 'edit' && (
                    <button type="button" className="danger" onClick={this.handleDelete.bind(this)}>Supprimer</button>
                  )}
                  <button type="button" className="secondary" onClick={this.closeForm.bind(this)}>Annuler</button>
                  <button type="submit" className="primary">Enregistrer</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }
}

// Render
ReactDOM.createRoot(document.getElementById('root')).render(<GristCalendar />);
