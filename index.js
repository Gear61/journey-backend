var express = require('express');
var app = express();
var FB = require('fb');

// PostgreSQL client
const { Client } = require('pg')

// Oauth client for Google login
const {OAuth2Client} = require('google-auth-library');
const GOOGLE_CLIENT_ID = "956612316816-n23cs49obd4fmn1qgs4abhqs7t3f6fnd.apps.googleusercontent.com";
const google_oauth_client = new OAuth2Client(GOOGLE_CLIENT_ID);

// POST body parsing
var bodyParser = require('body-parser');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('port', (process.env.PORT || 5000));

app.use(express.static(__dirname + '/public'));

app.get('/times', function(request, response) {
    var result = ''
    var times = process.env.TIMES || 5
    for (i=0; i < times; i++)
      result += i + ' ';
  	response.send(result);
});

app.get('/db', function (request, response) {
	const client = new Client({
		user: 'bwptlpjywkcdqm',
		password: '1323ec466a526b06a703766154b185c631a0f3bebf705c1a9e361153b673ca0b',
		host: 'ec2-184-72-228-128.compute-1.amazonaws.com',
		database: 'd31ledcluma0ap',
		port: 5432,
		ssl: true,
	});
	client.connect();

	client.query('SELECT NOW()', (err, res) => {
  		response.send(res.rows[0]);
  		client.end();
	})
});

app.post('/onboarding/facebook', function(request, response) {
	var access_token = request.body.access_token;

	FB.setAccessToken(access_token);
    FB.api('me', { fields: ['name', 'email', 'picture.type(large)'] }, function (res) {
	  	if(!res || res.error) {
	    	response.status(400);
		    response.send({'error': res.error});
			return;
		}

		response.status(200);
		var user_info = {};
		user_info['name'] = res.name;
		user_info['email'] = res.email;
	 	user_info['profile_picture_url'] = res.picture.data.url;
		response.send(user_info);
	});
});

app.post('/onboarding/google', function(request, response) {
	var id_token = request.body.id_token;
	verifyGoogleToken(id_token, response).catch(console.error);
});

async function verifyGoogleToken(token, response) {
  	const ticket = await google_oauth_client.verifyIdToken({
		idToken: token,
		audience: GOOGLE_CLIENT_ID,
	});
	const payload = ticket.getPayload();

	response.status(200);
	var user_info = {};
	user_info['name'] = payload['name'];
	user_info['email'] = payload['email'];
	user_info['profile_picture_url'] = payload['picture'];
	response.send(user_info);
}

app.listen(app.get('port'), function() {
  	console.log('Node app is running on port', app.get('port'));
});
