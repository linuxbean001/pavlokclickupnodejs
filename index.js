const pavlok = require('pavlok-beta-api-login');
const express = require('express');
const open = require('open');
const request = require('request');
const rp = require('request-promise');
const axios = require('axios');
const { Client } = require('pg');
const port = process.env.PORT || 8000 ;

const BASE_URL = "http://pavlok-mvp.herokuapp.com";
const pavlokcallbackUrl = "https://pavlok-clickup-linuxbean.herokuapp.com/auth/pavlok/result";
const pavlokcallbackUrlPath = "/auth/pavlok/result";

const pavlokclientid = 'ecc1be32cd55e1a09e1af8ff0a73174fa50c5d158dda650d977738c5ae10f9d7';
const pavloksecretid = '3f3c2407caf757efb94cfe67587a579f497fbd36a3c84597fbad249ac437398d';
const clickupclientid = 'KLUIBITGYCDF0XWLYIM44T2D6FFTIGO0';
const clickupsecretid = 'CLKU1XUZLM8Y6NZ2GT48CUPPU44DVAO0S5VIZA0NIDUWHMUSBDQJ2I7YUKI5ODSX';
const clickupredirecturi = 'pavlok-clickup-linuxbean.herokuapp.com';

const clickup_token = '';
console.log("Setting up remote...");

var app = express();

// set the view engine
app.set('view engine', 'hbs') ;

//Setup URLs
app.use(express.static(__dirname + '/public'));

//Setup Pavlok component
pavlok.init(pavlokclientid, pavloksecretid, {
	"verbose": true,
	"app" : app,
	"message": "Hello from the Pavlok Remote example!",
	"callbackUrl": pavlokcallbackUrl,
	"callbackUrlPath": pavlokcallbackUrlPath,
	"successUrl": "/",
	"errorUrl": "/error"
});

// Setup postgresql database connectivity
const client = new Client({
	user: 'sensorcore',
	host: '144.202.8.5',
	database: 'sensorcorestaging',
	password: 'sensorcore123',
	port: 5432,
	
});

client.connect();

// create new table in databse once
const createquery = 'CREATE TABLE IF NOT EXISTS pavclickupintegration (pavloktoken varchar,clickuptoken varchar, status int);';
client
    .query(createquery)
    .then(res => {
        console.log('Table is successfully created if not already created!');
    })
    .catch(err => {
        console.error(err);
    })
    .finally(() => {
        //client.end();
    });

// First callback when app load.
app.get("/", function(req, result){

	if(req.query.code){
		const clickupcode = req.query.code;
		axios
		.post('https://api.clickup.com/api/v2/oauth/token?client_id='+clickupclientid+'&client_secret='+clickupsecretid+'&code='+clickupcode)
		.then(res => {
		  //console.log(res.data.access_token);
		  //console.log(req.session.pavlok_token);
		  const insertPavlokToken = req.session.pavlok_token;
		  const insertClickupToken = res.data.access_token;
          req.session.clickup_token = res.data.access_token;
		  const qinsertuery = `
		  INSERT INTO pavclickupintegration (pavloktoken, clickuptoken, status)
		  VALUES ('${insertPavlokToken}', '${insertClickupToken}', 1)
		  `;
		  
          client.query(qinsertuery, (err, res) => {
            if (err) {
              console.error(err);
              result.redirect("main.html");
              return;
            }
            //console.log('Data insert successful');
            result.redirect("dashboard.html");
            //client.end();
          });
		})
		.catch(error => {
		  console.error(error.response) ;
		  result.redirect("main.html");
		})
		
        //result.send("authenticated");
	} else{
		if(pavlok.isLoggedIn(req)){
			const myAccessToken = req.session.pavlok_token ;
			console.log(myAccessToken);
			//const queryselect = 'SELECT * FROM pavclickupintegration where pavloktoken="'+myAccessToken+'"';
			const queryselect = `SELECT * FROM pavclickupintegration WHERE pavloktoken = '${myAccessToken}'`;
            
            client
              .query(queryselect)
              .then(res => {
                console.log(res.rows.length);
                if(res.rows.length == 0){
                  result.redirect("main.html");
                }
                else{
                  result.redirect("dashboard.html");
                }
              })
              .catch(err => {
                console.error(err);
                result.redirect("main.html");
              })
              .finally(() => {
                //client.end();
              });		
		 } else {
			result.redirect("login.html");
		}
    } 
});
app.get("/auth", function(req, result){
	pavlok.auth(req, result);
});
app.get("/zap", function(req, result){
	pavlok.zap({
		"request": req
	});
	console.log("Zapped!");
	result.redirect("dashboard.html");
});
app.get("/vibrate", function(req, result){
	pavlok.vibrate({
		"request": req
	});
	console.log("Vibrated!");
	result.redirect("dashboard.html");
});
app.get("/beep", function(req, result){
	pavlok.beep({
		"request": req
	});
	console.log("Beeped!");
	result.redirect("dashboard.html");
});
app.get("/pattern", function(req, result){
	pavlok.pattern({
		"request": req,
		"pattern": [ "beep", "vibrate", "zap" ],
		"count": 2
	});
	console.log("Pattern'd!");
	result.redirect("dashboard.html");
});
app.get("/logout", function(req, result){
	pavlok.logout(req);
	result.redirect("/");	
    console.log(req.session.pavlok_token);
});

app.get("/auth/clickup/", function(req, result){
	result.redirect('https://app.clickup.com/api?client_id='+clickupclientid+'&redirect_uri='+clickupredirecturi);
});

app.get("/mytasks", function(req, result){
  const myAccessToken = req.session.pavlok_token ;
  const myclickupToken = req.session.clickup_token ;
  
  console.log(myclickupToken);

	var options = {
		uri: 'https://api.clickup.com/api/v2/team',
		headers: {
			'Authorization': myclickupToken
		},
		json: true // Automatically parses the JSON string in the response
	};
	
	rp(options)
		.then(function (resp) {
			//console.log(resp);
			const teamID = resp.teams[0].id;
			var options2 = {
				url: 'https://api.clickup.com/api/v2/team/'+teamID+'/space?archived=false',
				headers: {
					'Authorization': myclickupToken
				},
				json: true // Automatically parses the JSON string in the response
			};
			return rp(options2);
			
		}).then(function(resp2) { 
			//console.log(resp2);
			//const spaceID = resp2;
			const spaceID = resp2.spaces[0].id;
			var options3 = {
				url: 'https://api.clickup.com/api/v2/space/'+spaceID+'/list?archived=false',
				headers: {
					'Authorization': myclickupToken
				},
				json: true // Automatically parses the JSON string in the response
			};
			return rp(options3);
			//console.log(spaceID);
		}).then(function(resp3) { 
			//console.log(resp2);
			//const spaceID = resp2;
			const listID = resp3.lists[0].id;
			var options4 = {
				url: 'https://api.clickup.com/api/v2/list/'+listID+'/task?archived=false',
				headers: {
					'Authorization': myclickupToken
				},
				json: true // Automatically parses the JSON string in the response
			};
			return rp(options4);
			//console.log(resp3);
		}).then(function(resp4) { 
			//console.log(resp2);
			//const spaceID = resp2;
			//const spaceID = resp3.spaces[0].id;
			console.log(resp4);
			result.render("tasks",resp4);
		}).catch(function (err) {
			// API call failed...
		});
	  
	//result.redirect("tasks.html");
	
});

app.get("/webhook", function(req, result){
    const myclickupToken = req.session.clickup_token ;
	var options = {
		uri: 'https://api.clickup.com/api/v2/team',
		headers: {
			'Authorization': myclickupToken
		},
		json: true // Automatically parses the JSON string in the response
	};
	
	rp(options)
		.then(function (resp) {
			//console.log(resp);
			const teamID = resp.teams[0].id;
			var options2 = {
				url: 'https://api.clickup.com/api/v2/team/'+teamID+'/webhook',
				headers: {
					'Authorization': myclickupToken
				},
				json: true // Automatically parses the JSON string in the response
			};
			return rp(options2);
			
		}).then(function(resp2) {
			console.log(resp2);
			if(resp2.webhooks.length>0){
				//console.log(resp2);
				/*console.log(resp2.webhooks[0].id);

                var options2 = {
					url: 'https://api.clickup.com/api/v2/team/'+teamID+'/webhook',
					headers: {
						'Authorization': myclickupToken
					},
					json: true // Automatically parses the JSON string in the response
				};
				return rp(options2);  */
			}
			
			//const spaceID = resp2;
			
		}).catch(function (err) {
			// API call failed...
		});
		result.send("Working");



});

app.get("/webhook/", function(req, result){
	//const myclickupToken = req.session.clickup_token ;
    //console.log(myclickupToken);
});

app.listen(port, function(){
	console.log("Visit the IP address of this machine, or http://localhost:8000/.");
});