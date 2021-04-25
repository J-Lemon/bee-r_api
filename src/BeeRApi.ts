import mqtt             from 'mqtt';
import * as winston     from 'winston';
import * as express     from 'express';
import * as PouchDB     from 'pouchdb';
import * as PouchdbFind from 'pouchdb-find';
PouchDB.plugin( PouchdbFind );

export default class BeerApi {
    private mqtt:           mqtt.MqttClient;
    private static istance: BeerApi;
    private readonly db:    PouchDB.Database;
    private readonly log:   winston.Logger;
    private readonly app:   express.Application;

    private constructor( dbName: string, port: number, logPath: string, mqttUrl: string | null ) {
        this.db  = new PouchDB( dbName );
        this.app = express();
        this.log = winston.createLogger( {
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'beer_api' },
            transports: [
              new winston.transports.File( { filename: logPath } ),
              new winston.transports.Console()
            ],
        } );
        this.app.get( '/query', this.query );

        if( mqttUrl != null )
            this.initMqtt( mqttUrl );

        this.app.listen( port, () => {
            this.log.info( `Http api listening on port ${port}` );
        } );
    }

    /**
     * Generate the api singleton object
     * @param dbName a string representing the db name.
     * @param port a number representing the port for http comunication.
     * @param logPath a string representing the path of log file.
     * @param mqttUrl a string representing the url of mqtt server or null for no update.
     * @returns an istance of BeerApi.
     */
    public static genInstance( dbName: string, port: number, logPath: string, mqttUrl: string | null = null ): BeerApi {
        if( BeerApi.istance == undefined )
            BeerApi.istance = new BeerApi( dbName, port, logPath, mqttUrl );
        return BeerApi.istance;
    }

    /**
     * Note: Used only for debug propose.
     * @returns the express application.
     */
    public getApp(): express.Application {
        return this.app;
    }

    /**
     * Adds a read from an hive.
     * Note: The hive data must contain client_id, date and metrics fields to be a valid read.
     * @param data an any object representing the hive read.
     */
    public async addHiveData( data: any ): Promise< void > {
        try{
            if( !data.hasOwnProperty( 'client_id' ) || typeof data.client_id != 'string' || data.client_id == '' ||
                !data.hasOwnProperty( 'date' )      || typeof data.date != 'string'      || data.date == ''      || 
                !data.hasOwnProperty( 'metrics' )   || !data.metrics.hasOwnProperty( 'length' ) )
                throw `Read "${JSON.stringify( data )}" is malformed`;
            
            await this.db.put( {_id: `${data.client_id}::${data.date}`, ...data} );
        }catch( error ){
            throw error;
        }
    }

    /**
     * Get a defined number of record from a hive
     * @param client_id a string representing the hive client_id.
     * @param limit a number representing the number of records to read.
     * @returns an array of records.
     */
    public async getHiveData( client_id: string, limit: number = 100 ): Promise<any[]> {
        try{
            return ( await this.db.find( {
                selector: { client_id },
                sort: [ {_id: 'desc'} ],
                limit
            } ) ).docs.map( e => JSON.parse( JSON.stringify( e ) ) );
        }catch( error ){
            throw error;
        }
    }

    /**
     * It's used by express query method.
     * Note: query parameter hive must be valorized as array or a single client_id otherwise a 400 will be returned. 
     */
    private async query( req: any, res: any ): Promise< void > {
        try{

            if( !req.query.hasOwnProperty( 'hive' ) )
                return res.status( 400 );

            const limit = req.query.hasOwnProperty( 'limit' ) ?
                                  parseInt( req.query.limit ) : 100;

            if( typeof req.query.hive == 'string' )
                return res.status( 200 )
                          .json( this.getHiveData( req.query.hive, limit ) );
            else
                return res.status( 200 )
                          .json( req.query.hive.reduce( ( a: any, c: string ) => {
                              a[ c ] = this.getHiveData( c, limit );
                          }, {} ) );
        }catch( error ){
            this.log.error( error );
            return res.status( 500 );
        }
    }

    /**
     * Starts the mqtt events listening
     * @param mqttUrl a string representing the url of mqtt server.
     */
    private initMqtt( mqttUrl: string ): void {
        this.mqtt = mqtt.connect( mqttUrl );
        this.mqtt.on( 'connect', () => {
            this.mqtt.subscribe( 'metrics', ( err ) => {
              if ( err ) {
                this.log.error( err );
                process.exit( 1 );
              }
              this.log.info( `MQTT listening for events on url ${mqttUrl}` );
            } );
        } );
        this.mqtt.on( 'message', async ( topic, message ) => {
            this.addHiveData( JSON.parse( message.toString() ) );
        } );
    }
}