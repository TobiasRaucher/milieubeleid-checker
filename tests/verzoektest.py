"""Test voor de selectie van commissieverzoeken en hun antwoorden: python3 tests/verzoektest.py"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "pipeline"))
import fetch_tk as F

WEL = [
    "Verzoek reactie op Commentaar Greenpeace Nederland t.b.v. technische briefing Rechtelijke uitspraak in de Bonaire-klimaatzaak d.d. 13 mei 2026",
    "Verzoek om een reactie op Reactie Greenpeace Nederland m.b.t. vonnis Klimaatzaak Bonaire",
    "Kabinetsreactie op het rapport Autonoom en Veilig van de Topsector Energie",
]
NIET = [
    "Voorstel tot wijziging van de lijst van controversiële onderwerpen van de vaste commissie voor Klimaat en Groene Groei",
    "Toestemming technische briefing COP31",
    "Aan stas BUZA en min KGG - verzoek toestemming technische briefing Nederlandse klimaatfinanciering",
    "Aan de minister van Infrastructuur en Waterstaat - Verzoek om aanwezigheid bij commissiedebat Externe veiligheid",
    "Aan bewindspersoon - reactie vragen",
]
for t in WEL:
    assert F.is_verzoek(t), t
for t in NIET:
    assert not F.is_verzoek(t), t


def brief(nr, onderwerp, datum, soort="Brief regering"):
    return {"Nummer": nr, "Soort": soort, "Onderwerp": onderwerp, "GestartOp": datum + "T00:00:00+02:00"}


zaak = {"GerelateerdNaar": [brief("1", "Reactie op rapport PAN Nederland", "2026-08-27"), brief("2", "Uitstel toezending reactie", "2026-07-01"),
                            brief("3", "Eerdere brief", "2026-06-02")],
        "GerelateerdVanuit": [brief("1", "Reactie op rapport PAN Nederland", "2026-08-27"), brief("4", "Motie", "2026-09-01", "Motie")]}
assert [a["zaak"] for a in F.verzoek_antwoorden([zaak], "2026-06-03")] == ["1"]

# rapport herkennen aan de eerste pagina's (2026D60381, waarvan de titel geen rapportwoord bevat)
assert not F.is_rapport("Effect van graslandvernieuwing op nitraatuitspoeling en lachgasemissie")
assert F.is_rapport_inhoud("Rapport\n1625\nEffect van graslandvernieuwing")
assert F.is_rapport_inhoud("Wageningen\nLivestock Research")
assert not F.is_rapport_inhoud("Geachte voorzitter, hierbij de stand van zaken")
print("verzoektest: goed")
