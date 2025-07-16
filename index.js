import fs from 'fs'
import readline from 'readline'
import open from 'open'
import { google } from 'googleapis'
import { log, padNum, getDateData, capitalize, getDynamicAsyncQueue, simpleFormatTime } from './services/util.service.js'
import { exec } from 'child_process'

// const gSheetId = '1e0w9MvC7xRmh1flTTfDwqhbZI86QEt7KM-zNgLgpm9I' // * Copy
const gSheetId = '1rc2pIfaDp9JTkCnG-oxXyBvOzw6Dub0dKQ5j6fEz5ac' // * Main
const gSheetName = 'Schedule-2024-New'
const gCalendarId = '545b72c6627673cd3a377213824ba2029b1793325beb6b9b092bf0736101a8eb@group.calendar.google.com';
let gUserName = 'Stav'
let gStartRowIdx = null


fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err)
    const credentials = JSON.parse(content)
    const PORT = credentials.installed.port || 3030
    authorize(credentials, findAndCreateEvents, PORT)
})


function authorize(credentials, callback, PORT) {
    const { client_secret, client_id, redirect_uris } = credentials.installed
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0])

    fs.readFile('token.json', async (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback, PORT)

        const tokenData = JSON.parse(token)
        //* Set credentials first
        oAuth2Client.setCredentials(tokenData)

        //* Check if token will expire soon (within 5 minutes)
        const expiryDate = new Date(tokenData.expiry_date)
        const now = new Date()
        const timeToRefresh = 30 * 60 * 1000

        if (expiryDate.getTime() - now.getTime() < timeToRefresh) {
            try {
                //* Refresh the token
                const { credentials } = await oAuth2Client.refreshToken(tokenData.refresh_token)

                //* Save the new token
                fs.writeFile('token.json', JSON.stringify(credentials), (err) => {
                    if (err) console.error('Error saving refreshed token:', err)
                    else console.log('Token refreshed and saved')
                })

                //* Update the credentials
                oAuth2Client.setCredentials(credentials)
            } catch (error) {
                console.error('Error refreshing token:', error)
                return getNewToken(oAuth2Client, callback)
            }
        }

        callback(oAuth2Client)
    })
}


function getNewToken(oAuth2Client, callback, PORT = 3030) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets.readonly', 'https://www.googleapis.com/auth/calendar'],
        prompt: 'consent'  //* This forces a refresh token to be generated
    })
    console.log('Authorize this app by visiting this url:', authUrl)


    //* starting server.js which serve a page that will get the code from query params
    const serverChildProcess = exec('node server.js', (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing command: ${error.message}`);
            return;
        }

        if (stderr) {
            console.error(`stderr: ${stderr}`);
            return;
        }

        console.log(`stdout: ${stdout}`);
    });

    //* Open in browser
    open(authUrl)

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    })
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close()

        //* Killing local server process
        serverChildProcess.kill()
        
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

        if (!gStartRowIdx) {
            const START_SEARCH_IDX = 700
            const initialRange = `${gSheetName}!A${START_SEARCH_IDX}:A${START_SEARCH_IDX + 500}`
            const initialRes = await sheets.spreadsheets.values.get({
                spreadsheetId: gSheetId,
                range: initialRange,
            })

            const tempRows = initialRes.data.values
            for (let i = 0; i < tempRows.length; i++) {
                if (tempRows[i][0]) {
                    const { day, month, year } = getDateData(tempRows[i][0])
                    const currentDate = new Date().toLocaleDateString('he')
                    const checkDate = new Date(year, month - 1, day).toLocaleDateString('he')
                    if (checkDate === currentDate) {
                        gStartRowIdx = START_SEARCH_IDX + i
                        break
                    }
                }
            }
            if (!gStartRowIdx) throw new Error(`Couldn't find current date. Provide an initial row start idx or check the google sheet for changes`)
        }
        const ranges = [`${gSheetName}!A1:1`, `${gSheetName}!A${gStartRowIdx}:ZZ`]
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

        const queueEvents = getDynamicAsyncQueue((eventData) => {
            console.log('\n')
            if (eventData.isExist) {
                log.bold.underline.red(`Event already exist:`)
                console.log(eventData.event)
            } else {
                log.bold.underline.green(`Event created:`)
                console.log(eventData.event)
            }
        })

        rows.forEach((row) => {

            row.forEach((cell, colIdx) => {
                if (cell.trim().includes(gUserName) && row[0]) {
                    const courseName = courseNames[colIdx - 1]
                    const lessonName = row[colIdx - 1]
                    const date = row[0]
                    const eveningKeyWords = ['evening', 'preground', 'introduction', 'ערב']
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
                    queueEvents(async () => createCalendarEvent(calendar, summary, dateTimeStart, dateTimeEnd))
                }
            })
        })


    } catch (err) {
        console.error('Google sheets API returned an error:', err)
    }
}

async function createCalendarEvent(calendar, summary, dateTimeStart, dateTimeEnd) {

    function formatToRFC3339(date) {
        return date.toISOString();
    }

    //* Check if the event already exists
    try {
        const response = await calendar.events.list({
            auth: calendar.auth,
            calendarId: gCalendarId,
            timeMin: formatToRFC3339(new Date(dateTimeStart)),
            timeMax: formatToRFC3339(new Date(dateTimeEnd)),
            q: summary,
            singleEvents: true,
        });

        const events = response.data.items;
        if (events && events.length > 0) {
            const formattedEvent = { summary, startTime: simpleFormatTime(dateTimeStart) }
            return { isExist: true, event: formattedEvent };
        }

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
        };

        await calendar.events.insert({
            auth: calendar.auth,
            calendarId: gCalendarId,
            resource: event,
        });
        const formattedEvent = {
            summary: event.summary,
            start: simpleFormatTime(event.start.dateTime),
            end: simpleFormatTime(event.end.dateTime),
        }
        return { isExist: false, event: formattedEvent };
    } catch (err) {
        console.error('Error while interacting with Google Calendar:', err);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}


