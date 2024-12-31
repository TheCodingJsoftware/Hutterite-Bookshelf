export enum Books {
    ALLELUIA_SING = "Alleluia Sing",
    ALLELUIA_SING_CHRISTMAS = "Alleluia Sing Christmas",
    ALLELUIA_SING_EASTER = "Alleluia Sing Easter",
    BAPTISM_BOOKLET = "Baptism Booklet",
    CONTEMPORARY = "Contemporary",
    GESANGBUCH = "Gesangbuch",
    HYMNS = "Hymns",
    KLEINE_GESANGBUCH = "Kleine Gesangbuch",
    PSALMLIEDER = "Psalmlieder",
    VATERLIEDER = "Väterlieder",
};

export enum Subjects {
    MORNING_SONGS = "Morgenlieder",
    EVENING_SONGS = "Abendlieder",
    CHRISTMAS_SONGS = "Weihnachtslieder",
    NEW_YEARS_SONGS = "Neujahrslieder",
    EASTER_SONGS = "Osternlieder",
    PENTECOST_SONGS = "Pfingstlieder",
    DEATH_SONGS = "Sterblieder",
    TABLE_SONGS = "Tischlieder",
    CHILDRENS_SONGS = "Kinderlieder",
};

export enum Languages {
    GERMAN = "German",
    ENGLISH = "English",
}

export class Tags {
    static readonly BOOKS = Books;
    static readonly GERMAN_SUBJECTS = Subjects;
    static readonly LANGUAGES = Languages;
}
