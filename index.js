import fs from 'fs'
import readline from 'readline'
import { google } from 'googleapis'

// const gSheetId = '1e0w9MvC7xRmh1flTTfDwqhbZI86QEt7KM-zNgLgpm9I' // * Copy
const gSheetId = '1rc2pIfaDp9JTkCnG-oxXyBvOzw6Dub0dKQ5j6fEz5ac' // * Main
let gUserName = 'Stav'
let gStartRowIdx = 382


fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err)
    authorize(JSON.parse(content), findAndCreateEvents)
})


function authorize(credentials, callback) {
    const { client_secret, client_id, redirect_uris } = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

    fs.readFile('token.json', (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback)
        oAuth2Client.setCredentials(JSON.parse(token))
        callback(oAuth2Client)
    })
}


function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/calendar'],
    })
    console.log('Authorize this app by visiting this url:', authUrl)
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close()
        oAuth2Client.getToken(code, (err, token) => {
            if (err) return console.error('Error retrieving access token', err)
            oAuth2Client.setCredentials(token)
            fs.writeFile('token.json', JSON.stringify(token), (err) => {
                if (err) return console.error(err)
                console.log('Token stored to', 'token.json')
            })
            callback(oAuth2Client)
        })
    })
}

async function findAndCreateEvents(auth) {
    const sheets = google.sheets({ version: 'v4', auth })
    const calendar = google.calendar({ version: 'v3', auth })
    gUserName = capitalize(gUserName)
    try {
        const ranges = [`Schedule-2024-New!A1:Z1`, `Schedule-2024-New!A${gStartRowIdx}:Z`]
        const res = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: gSheetId,
            ranges: ranges,
        })

        const [courseNames] = res.data.valueRanges[0].values
        const rows = res.data.valueRanges[1].values
        if (!rows.length) {
            console.log('No data found.')
            return
        }

        rows.forEach((row) => {
            row.forEach((cell, colIdx) => {
                if (cell.includes(gUserName) && row[0]) {
                    const courseName = courseNames[colIdx - 1]
                    const lessonName = row[colIdx - 1]
                    const date = row[0]
                    const eveningKeyWords = ['evening', 'preground', 'introduction']
                    const eveKeyWordsRegex = new RegExp(eveningKeyWords.join('|'), 'i')
                    let startHour = 8
                    if (eveKeyWordsRegex.test(courseName)) {
                        startHour = 17
                    }
                    const { day, month, year } = getDateData(date)
                    const dateIso = `${year}-${padNum(month)}-${padNum(day)}T`
                    const dateTimeStart = `${dateIso}${padNum(startHour)}:30:00`
                    const dateTimeEnd = `${dateIso}${padNum(startHour + 5)}:30:00`
                    const summary = `${gUserName} Lesson - ${courseName} - ${lessonName}`
                    createCalendarEvent(calendar, summary, dateTimeStart, dateTimeEnd)
                }
            })
        })


    } catch (err) {
        console.error('Google sheets API returned an error:', err)
    }
}

function createCalendarEvent(calendar, summary, dateTimeStart, dateTimeEnd) {
    const calendarId = '545b72c6627673cd3a377213824ba2029b1793325beb6b9b092bf0736101a8eb@group.calendar.google.com'
    const event = {
        summary,
        start: {
            dateTime: dateTimeStart,
            timeZone: 'Asia/Jerusalem',
        },
        end: {
            dateTime: dateTimeEnd,
            timeZone: 'Asia/Jerusalem',
        },
    }

    calendar.events.insert(
        {
            auth: calendar.auth,
            calendarId: calendarId,
            resource: event,
        },
        (err, event) => {
            if (err) {
                console.log('Error while contacting google calendar:', err)
                return
            }
            console.log('Event created:', event.data.htmlLink)
        }
    )
}

function padNum(num) {
    return (num + '').padStart(2, '0')
}

function getDateData(dateStr) {
    const [day, month, year] = dateStr.split('.')
    return { day, month, year }
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
