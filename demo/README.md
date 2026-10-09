## Demo: AI-sjekk (prototype)

En gratis sjekk for norske småbedrifter som viser hvor AI og automatisering kan spare tid, og hvilke tiltak som passer best. Brukeren svarer på fem spørsmål og får en score og anbefalte tiltak.

**Åpne demoen:** https://sauvage-pvt.github.io/ai-synlighet-pitch/demo/ai-sjekk.html

### Hva som er ekte

- Spørsmål, fremdrift og navigasjon
- Scoring: poengtabellen i koden regner ut score (0–100) og anbefalt tiltak
- Visning av resultat og låst tekst

### Hva som er simulert

- **Ingen e-post sendes.** Skjemaet viser bare neste steg.
- **Ingen data lagres.** Svarene forsvinner når siden lukkes.
- **Opplåsing er simulert.** Teksten blir synlig i demoen, men i den ferdige versjonen låses den først etter bekreftelse på e-post.

### Planlagt neste steg

- Backend på Cloudflare Worker med scoring på serversiden
- Dobbel bekreftelse på e-post før resultatet vises
- Lagring i D1 med sletting på forespørsel
- Automatisk opprydding av ubekreftede henvendelser etter 48 timer
- Personvernerklæring før lansering

### Scoring

Hvert av de fem spørsmålene gir poeng til ett eller flere av tre tiltak:

| Tiltak | Hva det løser |
|---|---|
| Bookinger utenfor åpningstid | Henvendelser som ikke blir besvart før neste dag |
| Kunder som har sluttet å komme | Kundebase som ikke følges opp |
| Synlighet i AI-søk | Om kunder finner bedriften via ChatGPT og lignende |

Totalscoren skaleres til 0–100. Tiltaket med høyest poeng anbefales. Hvis to tiltak er nesten like, vises begge.

### Kjøre lokalt

Åpne `demo/ai-sjekk.html` i en nettleser. Ingen installasjon eller npm kreves.
