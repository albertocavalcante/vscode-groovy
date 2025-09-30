import spock.lang.Specification

class SampleSpec extends Specification {

    def "should create sample object"() {
        given:
        def sample = new SampleClass()

        when:
        sample.setName('Test')

        then:
        sample.getName() == 'Test'
    }

    def "should greet with name"() {
        given:
        def sample = new SampleClass()
        sample.setName('World')

        expect:
        sample.greet() == 'Hello, World!'
    }
}