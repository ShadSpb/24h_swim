import logging
import re
import sys

class Configuration:
    '''Define application configuration according to config file and sets logging level'''
    def __init__(self):
        self.config = {}
        self.__read_config()
        self.__application_logging()

    def __read_config(self) -> None:
        '''Reads configuration of the backend and apply it in application'''
        mandatory_config_parameters = ['database_file','database_type', 'logging_type', 'logging_method']

        with open('config.cfg', mode = "rt", encoding = "utf8") as configuration_file:
            for line in configuration_file.readlines():
                if re.match(r'^(?P<Parameter>(?P<NAME>\w{1,})\s{0,}?=\s{0,}?(?P<VALUE>(\w{1,},?|.?){1,});)$', line):
                    values = re.search(r'^(?P<Parameter>(?P<NAME>\w{1,})\s{0,}?=\s{0,}?(?P<VALUE>(\w{1,},?|.?){1,});)$', line)
                    self.config[values.group(2).lower()] = values.group(3).lower().lstrip()

        for parameter in mandatory_config_parameters:
            try:
                self.config.get(parameter)
            except (ValueError):
                logging.warning("Can't read variable %s (wrong value). Set value to None", parameter)
                setattr(self.config, parameter, None)
            except (AttributeError):
                logging.warning("Can't read variable %s (wrong attribute). Set value to False", parameter)
                self.config['parameter'] = None

    def __application_logging(self) -> None:
        '''Define application logging according to configuration'''

        default_log_format = logging.Formatter('%(asctime)s:%(levelname)s:%(message)s')
        logging.basicConfig(format='%(asctime)s:%(levelname)s:%(message)s', level=logging.INFO, force=True)

        #To check that logging level is in place and have adequate value. Multivalue NOT supported. Can be refactored (Future enhancement)
        try:
            self.config.get('logging_level')
        except (ValueError):
            logging.warning("Can't read logging level (wrong value). Set log level to INFO")
            setattr(self.config, 'logging_level', 'INFO')
        except (AttributeError):
            logging.warning("Can't read logging level (wrong attribute). Set log level to INFO")
            self.config['logging_level'] = 'INFO'
        
        logging.debug("Point log target on %s", self.config.get('logging_method'))
        logging.getLogger().handlers.clear()
        for logging_method in self.config.get('logging_method').split(","):

            if logging_method == 'console':
                try:
                    handler = logging.StreamHandler(stream=sys.stdout)
                    handler.setFormatter(default_log_format)
                    logging.getLogger().addHandler(handler)
                    logging.info("Added Console as target method")
                except BaseException as error:
                    logging.error("Can't add %s logging method. %s", logging_method, error)

            elif logging_method == 'file':
                try:
                    handler = logging.FileHandler(filename='backend.log')
                    handler.setFormatter(default_log_format)
                    logging.getLogger().addHandler(handler)
                    logging.info("Added File as target method")
                except BaseException as error:
                    logging.error("Can't add %s logging method. %s", logging_method, error)

            else:
                logging.warning("Not supported logging method (%s). Set console.", logging_method)
                handler = logging.StreamHandler(stream=sys.stdout)
                handler.setFormatter(default_log_format)
                logging.getLogger().addHandler(handler)

        logging.debug("Trying to set log level on %s", self.config.get('logging_level'))
        if str(self.config.get('logging_level')).upper() in ['INFO', 'DEBUG', 'WARNING', 'ERROR', 'CRITICAL']:
            logging.getLogger().setLevel(self.config.get('logging_level').upper())
        else:
            logging.error("Wrong log level %s. Only 'INFO', 'DEBUG', 'WARNING', 'ERROR', 'CRITICAL' are supported. Set to INFO", str(self.config.get('logging_level')).upper())
            logging.getLogger().setLevel('INFO')