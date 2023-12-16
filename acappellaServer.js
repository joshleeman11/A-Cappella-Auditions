const fs = require("fs");
const express = require("express");
const { request } = require("http");
const path = require("path");
const app = express();
const httpSuccessStatus = 200;
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const user = process.env.MONGO_DB_USERNAME;
const passWord = process.env.MONGO_DB_PASSWORD;
const clientID =
    "XCv5ehJ2H9CUo5kNJWOx_MjimBLaDgkZhyqd63u1EJIwElQ2UqPIyZwJtE7g9R4h";
const clientSecret =
    "oqLQUPLplPiPoFxT8Rf7frj6YrXrNotb6ZsSeiUPg8KhJlF9diyLa-8ICyCUbR4WI5rIxrZfj1rwaKwlMrpfmg";
const clientAccessToken =
    "N7H8OktHuh8qn9AmafVjCyi2oL7gm3cGrlQyATxsHPvarzm_4hmpZGDcG5wj3wZT";

const uri = `mongodb+srv://${user}:${passWord}@cluster0.ggavldq.mongodb.net/?retryWrites=true&w=majority`;

const databaseAndCollection = {
    db: process.env.MONGO_DB_NAME,
    collection: process.env.MONGO_COLLECTION,
};
const { MongoClient, ServerApiVersion } = require("mongodb");
const { group } = require("console");
const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1,
});

async function songLyrics(songTitle, artist) {
    try {
        const response = await fetch(`https://api.genius.com/search?q=${artist}`, {
            headers: {
                Authorization: `Bearer ${clientAccessToken}`,
            },
        })

        if (!response.ok) {
            throw new Error('Network response was not ok.');
        }
        const data = await response.json()
        const songs = data?.response?.hits;
        const song = songs.find(song => song?.result?.title === songTitle)
        return song?.result?.url
    
    } catch (e) {
        console.error("Error searching for song:", error)
        return null
    }
}

async function addAudition(params) {
    try {
        await client.connect();
        const result = await client
            .db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection)
            .insertOne(params);
        console.log(`Added application ${result.insertedId}`);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookupGroupApplicants(group) {
    try {
        await client.connect();
        const cursor = await client
            .db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection)
            .find({ group: group });
        const result = await cursor.toArray();
        return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function lookupGroupAcceptances(group) {
    try {
        await client.connect();
        const cursor = await client
            .db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection)
            .find({ group: group, accepted: "yes" });
        const result = await cursor.toArray();
        return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}
app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");

app.get("/", (request, response) => {
    response.render("index");
});

app.get("/audition", (req, res) => {
    res.render("application");
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/confirmation", async (req, res) => {
    const { name, email, song, artist, group, bginfo } = req.body;
    const params = {
        name: name,
        email: email,
        group: group,
        bginfo: bginfo,
        songLyrics: `<a href="${await songLyrics(song, artist)}">${song} Lyrics</a>`
    };
    await addAudition(params);
    res.render("processApplication.ejs", params);
});

app.get("/adminGroupForm", (request, response) => {
    response.render("adminGroupForm");
});
global.group = "";
app.use(bodyParser.urlencoded({ extended: false }));
app.post("/processGroup", async (request, response) => {
    const group = request.body.musicGroup;
    global.group = request.body.musicGroup;
    const groupApplicantsInfo = await lookupGroupApplicants(group);

    let groupTable = "";
    groupApplicantsInfo.forEach((applicant) => {
        groupTable += `<tr><td><strong>${applicant.name}</strong></td>
                           <td><input type="radio" name="${applicant.name}" id="yes" value="yes">/<input type="radio" name="${applicant.name}" id="no" value="no"></td></tr>`;
    });
    groupTable += "</table>";
    response.render("groupFormProcess", { groupTable: groupTable });
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/decisionsConfirmation", async (request, response) => {
    const groupDecisions = request.body;
    console.log(groupDecisions);
    
    try {
        await client.connect();
        let groupConfirmation = "";
        for (const [name, decision] of Object.entries(groupDecisions)) {
            await client
                .db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection)
                .updateOne(
                    { group: global.group, name: name },
                    { $set: { accepted: decision } }
                );
            groupConfirmation += `<tr><td>${name}</td><td>${decision}</td></tr>`;
        }
        response.render("decisionsConfirmation", { groupConfirmation: groupConfirmation });
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
});

app.get("/auditionee", (request, response) => {
    response.render("auditionee");
});

app.use(bodyParser.urlencoded({ extended: false }));
app.post("/auditionee", async (request, response) => {
    const group = request.body.groupDropdown;
    const groupAcceptances = await lookupGroupAcceptances(group);
    let table = "<table border = 1><tr><th>Accepted</th></tr>";
    groupAcceptances.forEach((acceptance) => {
        table += `<table border = 1><tr><th>Accepted</th></tr><tr><td>${acceptance.name}</td></tr></table>`;
    });

    response.render("groupList", { group: group, table: table });
});

app.listen(3000);
console.log(`Web server started and running at http://localhost:3000`);

const prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.setEncoding("utf-8");
process.stdin.on("readable", () => {
    const dataInput = process.stdin.read();
    const command = dataInput?.trim();
    if (dataInput !== null) {
        if (command === "stop") {
            console.log("Shutting down the server");
            process.exit(0);
        }
    }
});
