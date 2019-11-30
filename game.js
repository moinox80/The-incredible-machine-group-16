// Modules
const Five = require('johnny-five');
const Oled = require('oled-js');
const Font = require('oled-font-5x7');
const {EventEmitter} = require('events');
const play = require('./modules/play.js');

var gameEnd = false;

// Instances
const board = new Five.Board({port: "COM4"});
const emitter = new EventEmitter();

// Sprites
const pikachu = require('./sprite/pikachu.js');

// Sounds
const anthem = require('./sounds/anthem.js');

// Arduino Components
var screens, buttons, piezo;

// Cursors Corresponding to Options
var currCursor = 0,
    currOption = 'attack',
    optionCursors = [
        [0,0],
        [0,9],
        [1,0]
    ],
    optionNames = [ 'attack', 'bag', 'run' ];

const actions = {
    attack: () => {
        screens['opponent'].clearDisplay();
        screens['opponent'].setCursor(16, 28);
        screens['opponent'].writeString(Font, 1, 'Bang, yer deid.', 1, true, 2);
        screens['opponent'].update();
    },
    // Bag
    bag: () => {
        screens['opponent'].clearDisplay();
        screens['opponent'].setCursor(4, 4);
        screens['opponent'].writeString(Font, 1, 'Bag:', 1, true, 2);
        
        screens['opponent'].setCursor(4, 12);
        screens['opponent'].writeString(Font, 1, 'Nuts, Medkit, Rolls', 1, true, 2);
        
        screens['opponent'].update();
    },
    // Run
    run: () => {
        gameEnd = true;

        screens['opponent'].clearDisplay();
        screens['opponent'].setCursor(16, 28);
        screens['opponent'].writeString(Font, 1, 'You ran away.', 1, true, 2);
        screens['opponent'].update();

        emitter.emit('game-over');
    }
}

board.on('ready', () => {

    let is_set_up = false;

    try {
        buttons = {
            action: new Five.Button({
                pin: 2,
                isPullup: true
            }),
            cycle: new Five.Button({
                pin: 3,
                isPullup: true
            })
        }

        for(let btn in buttons){
            buttons[btn]._name = btn;
            buttons[btn].on('press', function(){
                if(!gameEnd){
                    emitter.emit(btn);
                }
            });
        }

        piezo = new Five.Piezo(5);

        screens = {
            action: new Five.LCD({
                pins: [7, 8, 9, 10, 11, 12],
                backlight: 13,
                rows: 2,
                cols: 16
            }),
            opponent: new Oled(board, Five, {
                width: 128,
                height: 64,
                address: 0x3C
            })
        }

        screens['opponent'].clearDisplay();
        screens['opponent'].setCursor(4, 24);
        screens['opponent'].writeString(Font, 1, 'Press the button to begin.', 1, true, 2);
        screens['opponent'].update();

        screens['opponent'].startScroll('left', 0, 15);

        is_set_up = true;
    } catch(e){
        console.log('Error:', e);
    }

    if(!is_set_up){
        return console.log('There was a problem setting up.');
    }

    screens['action'].clear()
        .cursor(0,3).print('Bootlegmon')
        .cursor(1,2).print('Continue >>>');
    
    // Wait for the action button to be pressed,
    // then begin the game.
    emitter.once('action', function(){
        startGame();
    });
});

board.on('close', () => {
    // Avoid prolonged beep.
    piezo.noTone().off();

    // Clear screens and print goodbye message.
    screens['action'].clear().home().print('Goodbye');
    screens['opponent'].clearDisplay();
    screens['opponent'].update();
});

function drawOpponent(sprite){
    screens['opponent'].clearDisplay();
    screens['opponent'].buffer = sprite;
    screens['opponent'].invertDisplay(1);
    screens['opponent'].update();
}

function drawActions(){
    screens['action'].clear()
    .home().print('1.Attack 2.Bag')
    .cursor(1,0).print('3.Run')
    .home().blink();
}

function cycleOptions(){
    currCursor += currCursor === 2 ? -2 : 1;
    currOption = optionNames[currCursor];

    screens['action'].cursor(...optionCursors[currCursor]).blink();
}

function selectOption(){
    actions[currOption]();
}

function gameOver(){
    for(btn in buttons){
        // Effectively removes event listener. Can't use
        // removeListener, since functions aren't named.
        buttons[btn].on('press', () => {});
    }

    screens['action'].clear().home().print('Game Over.');
    play(piezo, anthem);
}

function startGame(){
    // Prep screens
    screens['opponent'].stopScroll();

    drawOpponent(pikachu);
    drawActions();

    // Events
    emitter.on('cycle', cycleOptions);
    emitter.on('action', selectOption);

    emitter.on('game-over', function(){
        gameOver();
    });
}