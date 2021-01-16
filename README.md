IjIk2
====

ijik2 on [Innokas-tapahtumaa](https://www.innokas.fi/) varten suunniteltu
helppokäyttöinen ja muokattava ilmoittautumisjärjestelmä.
Yksinkertaisen ilmoittautumisen saa käyntiin muutaman rivin konfiguraatiolla,
mutta plugin-systeemin avulla saa tehtyä hyvin monimutkaisiakin virityksiä.
Nimi tulee sanoista **I**lmoittautumis**j**ärjestelmä **I**nnokas-**k**isoihin (versio 2).

### Esimerkki
```python
# conf.py
# aja kommennolla uvicorn conf:app

# Tällä esimerkkikonfiguraatiolla saadaan ilmoittautuminen perusominaisuuksilla:
#     * ilmoittautujat saavat ilmoittautumissivun, jossa voi lisätä ja muokata omia joukkueita
#     * ilmoittautujat voivat jatkaa ilmoittautumista henkilökohtaisella avaimella

import ijik

app = ijik.create_app(
    db_path = "db.sqlite3",  # sqlite3-tietokannan polku
    plugins = [
        ijik.EditorPlugin()  # ilmoittautumisnäkymä-plugini
    ]
)
```

Asennus
-------
Kloonaa `ijik2`-repo, asenna python-paketti ja käännä javascript ja css-tiedostot.

```shell
git clone https://github.com/teknologiakerho/ijik2
cd ijik2
pip install .
npm install
npm run prod
```
Tarvitset lisäksi ajamiseen [ASGI](https://asgi.readthedocs.io/en/latest/)-palvelimen.
Hyvä vaihtoehto on [Uvicorn](https://www.uvicorn.org/).

Voit nyt testata ajamista yllä olevalla konffitiedostolla komennolla `uvicorn conf:app`.
Vakavampaan käyttöön katso esimerkiksi Uvicornin [Deployment-ohjeet](https://www.uvicorn.org/deployment/).
