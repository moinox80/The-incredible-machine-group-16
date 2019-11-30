const Wait = require('wait-for-stuff');

module.exports = (piezo, song) => {
    for(let i = 0; i < song.melody.length; ++i){
        let noteDuration = 2000 / song.durations[i],
            pause = noteDuration * 1.30;
        
        console.log(i);
        piezo.frequency(song.melody[i], noteDuration);

        Wait.for.time(pause);
        Piezo.noTone();
    }
}